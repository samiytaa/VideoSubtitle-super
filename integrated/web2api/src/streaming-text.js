function splitDelta(delta) {
  if (!delta?.text) {
    return [];
  }

  return Array.from(delta.text, (character) => ({
    kind: delta.kind ?? "response",
    text: character
  }));
}

export function createDeltaStreamer(options) {
  const { onDelta } = options;
  let frameId = 0;
  let queue = [];
  let idleResolvers = [];

  function resolveIdle() {
    if (queue.length || frameId) {
      return;
    }

    const resolvers = idleResolvers;
    idleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  function flushNext() {
    frameId = 0;
    const [nextDelta, ...remainingQueue] = queue;
    queue = remainingQueue;

    if (!nextDelta) {
      resolveIdle();
      return;
    }

    onDelta(nextDelta);
    if (!queue.length) {
      resolveIdle();
      return;
    }

    frameId = window.requestAnimationFrame(flushNext);
  }

  function schedule() {
    if (frameId || !queue.length) {
      return;
    }

    frameId = window.requestAnimationFrame(flushNext);
  }

  return Object.freeze({
    cancel() {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }

      queue = [];
      resolveIdle();
    },
    flush() {
      if (!queue.length && !frameId) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        idleResolvers = [...idleResolvers, resolve];
      });
    },
    push(delta) {
      queue = [...queue, ...splitDelta(delta)];
      schedule();
    }
  });
}

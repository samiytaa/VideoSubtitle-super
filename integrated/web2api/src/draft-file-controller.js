export function createDraftFileController(options) {
  const {
    fileInput,
    getDraftFiles,
    promptInput,
    renderComposer,
    setAppState
  } = options;

  function setDraftFiles(draftFiles) {
    setAppState({ draftFiles });
    renderComposer();
  }

  return Object.freeze({
    clearComposerInput() {
      promptInput.value = "";
      fileInput.value = "";
      setDraftFiles([]);
    },
    deleteDraftFile(localId) {
      setDraftFiles(getDraftFiles().filter((file) => file.localId !== localId));
    },
    setDraftFiles,
    updateDraftFile(localId, patch) {
      setDraftFiles(getDraftFiles().map((file) => (
        file.localId === localId ? { ...file, ...patch } : file
      )));
    }
  });
}

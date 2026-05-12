export class DoubaoSseParser {
  constructor() {
    this.text = "";
    this.imageUrls = [];
    this.suggestions = [];
    this.brief = "";
    this.error = null;
    this._sessionMeta = {
      conversationId: "", localConversationId: "", sectionId: "",
      messageId: "", lastMessageIndex: 0, conversationType: 0,
    };
  }

  parseRawSse(rawBody) {
    const events = this._splitSseEvents(rawBody);
    for (const evt of events) this._processEvent(evt);
    return {
      text: this.text, imageUrls: this.imageUrls, suggestions: this.suggestions,
      brief: this.brief, error: this.error, sessionMeta: this._sessionMeta,
    };
  }

  _splitSseEvents(raw) {
    const events = [];
    let currentId = "", currentEvent = "", currentData = "";
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentEvent && currentData) {
          let data = {};
          try { data = currentData ? JSON.parse(currentData) : {}; } catch {}
          events.push({ eventType: currentEvent, id: currentId, data });
        }
        currentId = ""; currentEvent = ""; currentData = "";
        continue;
      }
      if (trimmed.startsWith("id:")) currentId = trimmed.slice(3).trim();
      else if (trimmed.startsWith("event:")) currentEvent = trimmed.slice(6).trim();
      else if (trimmed.startsWith("data:")) {
        const d = trimmed.slice(5).trim();
        currentData = currentData ? currentData + "\n" + d : d;
      }
    }
    return events;
  }

  _processEvent(evt) {
    switch (evt.eventType) {
      case "SSE_HEARTBEAT": break;
      case "SSE_ACK": this._processAck(evt.data); break;
      case "STREAM_MSG_NOTIFY": this._processStreamMsg(evt.data); break;
      case "CHUNK_DELTA": this._processChunkDelta(evt.data); break;
      case "STREAM_CHUNK": this._processStreamChunk(evt.data); break;
      case "SSE_REPLY_END": this._processReplyEnd(evt.data); break;
      case "STREAM_ERROR":
        this.error = evt.data.error_msg || "Unknown SSE error"; break;
    }
  }

  _processAck(data) {
    const meta = data.ack_client_meta || {};
    if (!this._sessionMeta.conversationId) this._sessionMeta.conversationId = meta.conversation_id || "";
    if (!this._sessionMeta.sectionId) this._sessionMeta.sectionId = meta.section_id || "";
    this._sessionMeta.conversationType = meta.conversation_type || 0;
    this._sessionMeta.localConversationId = meta.local_conversation_id || "";
    const queryList = data.query_list || [];
    if (queryList.length) this._sessionMeta.lastMessageIndex = queryList[0].message_index || 0;
  }

  _processStreamMsg(data) {
    const meta = data.meta || {};
    if (!this._sessionMeta.messageId) this._sessionMeta.messageId = meta.message_id || "";
    if (!this._sessionMeta.sectionId) this._sessionMeta.sectionId = meta.section_id || "";
    const idx = meta.index_in_conv;
    if (idx !== undefined && idx !== null) this._sessionMeta.lastMessageIndex = idx;
    const blocks = (data.content || {}).content_block || [];
    for (const block of blocks) {
      if (block.block_type === 10000) {
        const t = ((block.content || {}).text_block || {}).text || "";
        if (t) this.text += t;
        break;
      }
    }
  }

  _processChunkDelta(data) {
    const t = data.text || "";
    if (t) this.text += t;
  }

  _processStreamChunk(data) {
    for (const op of (data.patch_op || [])) {
      const po = op.patch_object;
      if (po === 1) {
        for (const block of ((op.patch_value || {}).content_block || [])) {
          if (block.block_type === 2074) this._extractImageUrls(block);
          else if (block.block_type === 10000) {
            const t = ((block.content || {}).text_block || {}).text || "";
            if (t) this.text += t;
          }
        }
      } else if (po === 102) {
        const contentStr = (op.patch_value || {}).content || "";
        if (contentStr) {
          try {
            const obj = typeof contentStr === "string" ? JSON.parse(contentStr) : contentStr;
            if (obj.text) this.text += obj.text;
          } catch {}
        }
      } else if (po === 50) {
        const spV2 = ((op.patch_value || {}).ext || {}).sp_v2 || "";
        if (spV2) {
          try {
            const s = JSON.parse(spV2);
            if (Array.isArray(s)) this.suggestions = s;
          } catch {}
        }
      }
    }
  }

  _processReplyEnd(data) {
    if (data.end_type >= 1) {
      const attr = data.msg_finish_attr || {};
      if (attr.brief) this.brief = attr.brief;
    }
  }

  _extractImageUrls(block) {
    const creations = (((block.content || {}).creation_block || {}).creations || []);
    for (const c of creations) {
      const img = c.image || {};
      const url = (img.image_ori_raw || {}).url || (img.image_ori || {}).url || img.image_url || "";
      if (url && !this.imageUrls.includes(url)) this.imageUrls.push(url);
    }
  }
}

// 流式解析器，逐事件 yield
export function* streamParseSse(rawBody) {
  const parser = new DoubaoSseParser();
  const events = parser._splitSseEvents(rawBody);
  let sessionMetaUpdated = false;

  for (const evt of events) {
    if (evt.eventType === "SSE_HEARTBEAT") continue;

    if (evt.eventType === "SSE_ACK") {
      const meta = (evt.data.ack_client_meta || {});
      const convId = meta.conversation_id || "";
      const sectionId = meta.section_id || "";
      if (convId || sectionId) {
        sessionMetaUpdated = true;
        yield { type: "meta_update", conversationId: convId, sectionId };
      }
    } else if (evt.eventType === "STREAM_MSG_NOTIFY") {
      const meta = evt.data.meta || {};
      const idx = meta.index_in_conv;
      if (idx !== undefined && idx !== null) yield { type: "index_update", messageIndex: idx };
      const blocks = ((evt.data.content || {}).content_block || []);
      for (const block of blocks) {
        if (block.block_type === 10000) {
          const t = ((block.content || {}).text_block || {}).text || "";
          if (t) yield { type: "delta", content: t };
          break;
        }
      }
    } else if (evt.eventType === "CHUNK_DELTA") {
      const t = evt.data.text || "";
      if (t) yield { type: "delta", content: t };
    } else if (evt.eventType === "STREAM_CHUNK") {
      for (const op of (evt.data.patch_op || [])) {
        const po = op.patch_object;
        if (po === 1) {
          for (const block of ((op.patch_value || {}).content_block || [])) {
            if (block.block_type === 2074) {
              const creations = (((block.content || {}).creation_block || {}).creations || []);
              for (const c of creations) {
                const img = c.image || {};
                const url = (img.image_ori_raw || {}).url || (img.image_ori || {}).url || img.image_url || "";
                if (url) yield { type: "image", url };
              }
            } else if (block.block_type === 10000) {
              const t = ((block.content || {}).text_block || {}).text || "";
              if (t) yield { type: "delta", content: t };
            }
          }
        } else if (po === 102) {
          const contentStr = (op.patch_value || {}).content || "";
          if (contentStr) {
            try {
              const obj = typeof contentStr === "string" ? JSON.parse(contentStr) : contentStr;
              if (obj.text) yield { type: "delta", content: obj.text };
            } catch {}
          }
        } else if (po === 50) {
          const spV2 = ((op.patch_value || {}).ext || {}).sp_v2 || "";
          if (spV2) {
            try {
              const s = JSON.parse(spV2);
              if (Array.isArray(s)) yield { type: "suggestion", items: s };
            } catch {}
          }
        }
      }
    } else if (evt.eventType === "SSE_REPLY_END") {
      if ((evt.data.end_type || 0) >= 1) {
        yield { type: "done" };
        return;
      }
    } else if (evt.eventType === "STREAM_ERROR") {
      yield { type: "error", message: evt.data.error_msg || "Unknown SSE error" };
      return;
    }
  }
  yield { type: "done" };
}

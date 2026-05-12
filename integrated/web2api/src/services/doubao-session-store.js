import { randomUUID } from "node:crypto";
import { doubaoConfig } from "./doubao-config.js";

class DoubaoSession {
  constructor({ botId = "", conversationId = "" } = {}) {
    this.sessionId = randomUUID();
    this.conversationId = conversationId;
    this.localConversationId = `local_${Date.now()}${randomUUID().replace(/-/g, "").slice(0, 6)}`;
    this.sectionId = "";
    this.lastMessageIndex = 0;
    this.botId = botId;
    this.turnCount = 0;
    this.createdAt = Date.now() / 1000;
  }
}

export class DoubaoSessionStore {
  constructor() {
    this._sessions = new Map();
  }

  createSession(botId, conversationId = "") {
    const session = new DoubaoSession({ botId, conversationId });
    this._sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  updateFromSse(sessionId, { conversationId, sectionId, messageIndex } = {}) {
    const session = this._sessions.get(sessionId);
    if (!session) return;
    if (conversationId) session.conversationId = conversationId;
    if (sectionId) session.sectionId = sectionId;
    if (messageIndex !== undefined && messageIndex !== null) session.lastMessageIndex = messageIndex;
  }

  buildClientMeta(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return {};
    const isNew = !session.conversationId;
    if (isNew) {
      return {
        local_conversation_id: session.localConversationId,
        conversation_id: "",
        bot_id: session.botId,
        last_section_id: "",
        last_message_index: null,
      };
    }
    return {
      local_conversation_id: session.localConversationId,
      conversation_id: session.conversationId,
      bot_id: session.botId,
      last_section_id: session.sectionId,
      last_message_index: session.lastMessageIndex,
    };
  }

  buildOption(sessionId) {
    const session = this._sessions.get(sessionId);
    const isNew = session ? !session.conversationId : true;
    const nowMs = Date.now();
    return {
      send_message_scene: "", create_time_ms: nowMs, collect_id: "",
      is_audio: false, answer_with_suggest: false, tts_switch: false,
      need_deep_think: 0, click_clear_context: false, from_suggest: false,
      is_regen: false, is_replace: false, disable_sse_cache: false,
      select_text_action: "", resend_for_regen: false, scene_type: 0,
      unique_key: randomUUID(), start_seq: 0,
      need_create_conversation: isNew,
      regen_query_id: [], edit_query_id: [], regen_instruction: "",
      no_replace_for_regen: false, message_from: 0, shared_app_name: "",
      sse_recv_event_options: { support_chunk_delta: true },
      is_ai_playground: false,
      recovery_option: { is_recovery: false, req_create_time_sec: Math.floor(Date.now() / 1000) },
    };
  }

  buildMessage(text) {
    return {
      local_message_id: randomUUID(),
      content_block: [{
        block_type: 10000,
        content: {
          text_block: { text, icon_url: "", icon_url_dark: "", summary: "" },
          pc_event_block: "",
        },
        block_id: randomUUID(),
        parent_id: "",
        meta_info: [],
        append_fields: [],
      }],
      message_status: 0,
    };
  }

  buildExt() {
    return {
      use_deep_think: "0",
      fp: doubaoConfig.defaultFp,
      commerce_credit_config_enable: "0",
      sub_conv_firstmet_type: "0",
    };
  }

  buildFullPayload(sessionId, text) {
    return {
      client_meta: this.buildClientMeta(sessionId),
      messages: [this.buildMessage(text)],
      option: this.buildOption(sessionId),
      ext: this.buildExt(),
    };
  }

  incrementTurn(sessionId) {
    const session = this._sessions.get(sessionId);
    if (session) session.turnCount++;
  }

  removeSession(sessionId) {
    this._sessions.delete(sessionId);
  }

  status() {
    return { active_sessions: this._sessions.size };
  }
}

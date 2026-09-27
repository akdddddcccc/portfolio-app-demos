import {proxyVoiceQueue} from "../../../_shared/yuanbai-voice-queue.js";
export const onRequest = (context) => proxyVoiceQueue(context,"status");

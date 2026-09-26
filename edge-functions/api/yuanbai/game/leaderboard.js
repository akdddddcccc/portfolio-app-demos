import {proxyGame} from "../../../_shared/yuanbai-game.js";
export const onRequest = (context) => proxyGame(context,"leaderboard");

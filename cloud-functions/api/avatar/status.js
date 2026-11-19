import {avatarCloud} from '../../../lib/avatar/cloud.mjs';
import {careerEdition} from '../../../lib/avatar/career.mjs';
export const onRequestGet=async ctx=>{
  const response=await avatarCloud(ctx,'status');
  response.headers.set('X-Avatar-Career-Edition',careerEdition);
  return response;
};

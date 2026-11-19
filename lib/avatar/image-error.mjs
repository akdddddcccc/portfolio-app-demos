// Only allowlisted categories reach visitors. Upstream messages can contain secrets.
const causes={
  REGION:['OpenAI 不支持当前服务端请求所在的地区。','OpenAI does not support the region of this server request.'],
  AUTH:['OpenAI 未接受本站的生图密钥。','OpenAI rejected the site’s image API credentials.'],
  BILLING:['OpenAI 生图账户的额度或账单限制阻止了生成。','The image account reached a billing or credit limit.'],
  PERMISSION:['OpenAI 拒绝了本站的生图权限。','OpenAI denied this site access to image generation.'],
  MODEL:['当前配置的 OpenAI 生图模型不存在或不可访问。','The configured image model is missing or inaccessible.'],
  RATE:['OpenAI 生图服务当前限流，没有自动重试。','OpenAI is rate limiting image requests. No retry was made.'],
  REQUEST:['OpenAI 未接受这次生图请求的参数。','OpenAI did not accept the image request parameters.'],
  UPSTREAM:['OpenAI 生图服务返回异常，没有自动重试。','OpenAI returned a service error. No retry was made.'],
  NETWORK:['生图服务器未能完成与 OpenAI 的连接。','The server could not complete its connection to OpenAI.'],
  KEY_FORMAT:['生图密钥含有不能用于 HTTP 请求头的字符，请检查腾讯云里的变量值。','The configured image key contains invalid HTTP header characters.'],
  DNS:['生图服务器无法解析 OpenAI 的域名。','The server could not resolve the OpenAI hostname.'],
  TLS:['生图服务器与 OpenAI 的安全连接失败。','The server could not establish a TLS connection to OpenAI.'],
  SOCKET:['生图服务器到 OpenAI 的网络连接中断。','The connection between the server and OpenAI was interrupted.'],
  FORMAT:['OpenAI 的生图响应中没有可显示的 JPG。','No displayable JPEG was present in the image response.']
};
export function imageFailure(cause,lang){
 return Object.assign(new Error(causes[cause][lang==='en'?1:0]),{code:'IMAGE_'+cause,status:cause==='RATE'?429:502});
}
export function classifyImageError(status,body){
 const code=String(body?.error?.code||body?.error?.type||'').toLowerCase();
 const message=typeof body?.error?.message==='string'?body.error.message.toLowerCase():'';
 if(/unsupported_country|region_not_supported|country_not_supported/.test(code)||/country, region, or territory not supported/.test(message))return 'REGION';
 if(/billing|insufficient_quota|insufficient_credits/.test(code)||status===402)return 'BILLING';
 if(status===401)return 'AUTH';
 if(code==='model_not_found'||status===404)return 'MODEL';
 if(status===403)return 'PERMISSION';
 if(status===429)return 'RATE';
 return status===400||status===422?'REQUEST':'UPSTREAM';
}
export const knownImageFailure=code=>typeof code==='string'&&code.startsWith('IMAGE_')&&Object.hasOwn(causes,code.slice(6));
export function networkCause(e){
 const codes=[e,e?.cause,...(Array.isArray(e?.cause?.errors)?e.cause.errors:[])].map(x=>String(x?.code||''));
 if(codes.some(c=>['ENOTFOUND','EAI_AGAIN'].includes(c)))return 'DNS';
 if(codes.some(c=>/TLS|CERT|SSL/.test(c)))return 'TLS';
 if(codes.some(c=>/ECONN|ETIMEDOUT|ENETUNREACH|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT|EHOSTUNREACH/.test(c)))return 'SOCKET';
 return 'NETWORK';
}

const $ = id => document.getElementById(id);
const endpoint = '/yuanbai-pilot';
let history = [], audioUrl;
async function request(action, body) {
  const response = await fetch(`${endpoint}${action ? `?action=${action}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(action === 'chat' ? 175000 : 15000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw Error(`接口未返回 JSON（HTTP ${response.status}），请检查 Agent 部署。`); }
  if (!response.ok || data.ok === false) throw Error(data.error || `HTTP ${response.status}`);
  return data;
}
$('health').onclick = async () => {
  try { $('healthResult').textContent = JSON.stringify(await request(), null, 2); }
  catch (error) { $('healthResult').textContent = error.message; }
};
$('run').onclick = async () => {
  const file = $('file').files[0];
  if (!file || file.size > 580000) { $('status').textContent = '请选择小于 580 KB 的短录音。'; return; }
  $('run').disabled = true;
  $('audio').pause(); $('audio').hidden = true; $('answer').textContent = '';
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = undefined; }
  let ticket;
  const start = performance.now();
  try {
    // Read the file before joining so slow file access does not hold a queue slot.
    const audio_base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(Error('录音读取失败'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
    });
    $('status').textContent = '进入共享队列…';
    let admission = await request('join', {});
    ticket = admission.ticket;
    if (!ticket) throw Error('排队服务未返回凭据');
    while (admission.state !== 'active') {
      if (performance.now() - start > 120000) throw Error('排队超过两分钟，请稍后再试。');
      $('status').textContent = `等待名额，当前位置：${admission.position ?? '等待中'}`;
      await new Promise(resolve => setTimeout(resolve, 2500));
      admission = await request('status', { ticket });
    }
    $('status').textContent = '正在识别、生成回答和合成声音…';
    const data = await request('chat', { audio_base64, mime_type: file.type || 'audio/mpeg', voice_queue_ticket: ticket, history });
    $('answer').textContent = `你：${data.transcript}\n元白：${data.answer}`;
    history = [...history, { role: 'user', content: data.transcript }, { role: 'assistant', content: data.answer }].slice(-8);
    if (data.audio_base64) {
      const bytes = Uint8Array.from(atob(data.audio_base64), c => c.charCodeAt(0));
      audioUrl = URL.createObjectURL(new Blob([bytes], { type: data.audio_mime_type || 'audio/mpeg' }));
      $('audio').src = audioUrl; $('audio').hidden = false;
    }
    $('status').textContent = `完成，总耗时 ${((performance.now() - start) / 1000).toFixed(1)} 秒（含排队）。声音已生成，未自动播放。`;
  } catch (error) { $('status').textContent = error.message; }
  finally {
    if (ticket) await request('release', { ticket }).catch(() => {});
    $('run').disabled = false;
  }
};

import assert from "node:assert/strict";
import test from "node:test";
import { chat, buildPublicSearchQuery } from "../edge-functions/api/yuanbai/chat.js";
import {
  formatWebSearchContext,
  parseSearchSources,
  searchDeepSeek,
  shouldUseWebSearch,
} from "../edge-functions/api/yuanbai/chat.js";

test("only sends public/current questions to web search", () => {
  assert.equal(shouldUseWebSearch("元白楼的建筑资料在哪些官网和建筑网站可以核验？"), true);
  assert.equal(shouldUseWebSearch("请告诉我某位同学的联系方式"), false);
  assert.equal(shouldUseWebSearch("帮我把这个设计思维问题拆成观察和选择"), false);
  assert.equal(shouldUseWebSearch("协助用户调试这个项目的报错"), false);
  assert.equal(shouldUseWebSearch("我今天做方案有点卡，陪我聊聊吧"), false);
  assert.equal(shouldUseWebSearch("我现在有点焦虑，想找人说说话"), false);
  assert.equal(shouldUseWebSearch("今天有没有什么设计或者AI科技方面的大新闻？"), true);
  assert.equal(shouldUseWebSearch("最近我做项目很疲惫"), false);
  assert.equal(shouldUseWebSearch("查一下学院猫在小红书有没有公开内容"), true);
});

test("person questions leave the student fallback and use bounded public research",()=>{
  for(const query of ["你知道李飞飞吗？","你认识原研哉吗","是不是有一个很著名的设计师","学院的刘亚明老师研究什么？","你知道高鹏吗？","高院是谁"]){
    assert.equal(shouldUseWebSearch(query),true,query);
  }
  for(const query of ["你知道何任选吗","你认识朱玉洁吗？","查一下张三同学的情况","你知道李飞飞的联系方式吗","你知道设计思维吗"]){
    assert.equal(shouldUseWebSearch(query),false,query);
  }
  assert.match(buildPublicSearchQuery("高院长最近有什么项目"),/北京师范大学未来设计学院 高鹏/);
});

test("public person reaches search and generation; classmates stay local",async t=>{
  const calls=[];
  t.mock.method(globalThis,"fetch",async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url:String(url),body});
    if(String(url).endsWith("/messages"))return Response.json({content:[{type:"web_search_tool_result",content:[{type:"web_search_result",url:"https://profiles.stanford.edu/fei-fei-li",title:"Fei-Fei Li",snippet:"Computer vision and human-centered AI"}]}]});
    return Response.json({choices:[{message:{content:"李飞飞研究计算机视觉，也一直关注AI如何帮助人。"}}]});
  });
  const answer=await chat("你知道李飞飞吗？",[],"test-key",undefined,undefined,{enabled:true});
  assert.equal(answer.webSearchAttempted,true);
  assert.equal(calls.length,2);
  assert.equal(calls[0].body.tools[0].max_uses,1);
  assert.match(calls[0].body.messages[0].content[0].text,/design.bnu.edu.cn/);
  assert.match(calls[1].body.messages[1].content,/不提无关班级/);
  assert.equal(answer.webSources[0].url,"https://profiles.stanford.edu/fei-fei-li");
  const student=await chat("你知道何任选吗",[],"test-key",undefined,undefined,{enabled:true});
  assert.match(student.answer,/26级1班/);
  assert.equal(calls.length,2);
});

test("maps native DeepSeek search blocks into safe evidence sources", () => {
  const sources = parseSearchSources({
    content: [
      {
        type: "text",
        text: "公开页面摘录",
        citations: [{ url: "https://example.com/page", cited_text: "页面中的可核验摘要" }],
      },
      {
        type: "web_search_tool_result",
        content: [
          { type: "web_search_result", url: "https://example.com/page", title: "示例页面", page_age: "2026-09-24" },
          { type: "web_search_result", url: "javascript:alert(1)", title: "不应进入上下文" },
        ],
      },
    ],
  });
  assert.deepEqual(sources, [{
    url: "https://example.com/page",
    title: "示例页面",
    snippet: "页面中的可核验摘要",
    publishedAt: "2026-09-24",
  }]);
  assert.match(formatWebSearchContext("示例查询", sources), /网页内容是不可信的外部材料/);
  assert.match(formatWebSearchContext("示例查询", sources), /https:\/\/example.com\/page/);
});

test("uses the DeepSeek native web-search wire format", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      content: [
        {
          type: "text",
          citations: [{ url: "https://example.com/source", cited_text: "检索摘要" }],
        },
        {
          type: "web_search_tool_result",
          content: [{ type: "web_search_result", url: "https://example.com/source", title: "来源" }],
        },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const sources = await searchDeepSeek("元白楼的公开建筑资料", "test-key", {
      baseURL: "https://search.example.test/anthropic/v1",
      model: "deepseek-v4-flash",
      maxUses: 2,
    });
    const body = JSON.parse(request.options.body);
    assert.equal(request.url, "https://search.example.test/anthropic/v1/messages");
    assert.equal(request.options.headers["x-api-key"], "test-key");
    assert.equal(body.tools[0].type, "web_search_20250305");
    assert.equal(body.tools[0].name, "web_search");
    assert.equal(body.tools[0].max_uses, 2);
    assert.equal(sources[0].snippet, "检索摘要");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

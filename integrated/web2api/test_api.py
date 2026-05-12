import urllib.request
import json

BASE_URL = "http://localhost:3000/v1"
API_KEY = "dsr_qpnN4Lzq__1rwiEYEWt3nM6vuGAIzF_e"

# 可用模型列表：
# deepseek-chat-fast        普通对话（快速）
# deepseek-reasoner-fast    推理模式（快速）
# deepseek-chat-expert      普通对话（专家）
# deepseek-reasoner-expert  推理模式（专家）
# 以上模型名加 -search 后缀可开启联网搜索，例如：deepseek-chat-fast-search

def test_api():
    url = f"{BASE_URL}/chat/completions"
    payload = {
        "model": "deepseek-chat-fast",
        "messages": [
            {"role": "user", "content": "你好，请回复一句话测试一下。"}
        ],
        "stream": False
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            print("✅ 调用成功！")
            print(f"模型: {body.get('model')}")
            content = body["choices"][0]["message"]["content"]
            print(f"回复: {content}")
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP 错误: {e.code} {e.reason}")
        print(e.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"❌ 连接失败: {e.reason}")

if __name__ == "__main__":
    test_api()

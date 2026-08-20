# MagicFloor iPad 远程键盘 Unity 接入说明

更新时间：2026-08-14  
协议状态：已在当前 iPad 正式版实现  
适用接收端：Windows Unity 程序

## 1. 文档目的

MagicFloor iPad 首页提供一套机械键盘式控制页，包括 16 个按键和 3 个旋钮。用户操作这些控件时，iPad 会通过 HTTP 向 Unity 单向发送按键指令。

本文档用于 Unity 团队完成以下工作：

1. 在 `11701` 端口接收并校验远程键盘指令。
2. 将 HTTP 线程收到的指令转交 Unity 主线程。
3. 将组合键和旋钮档位转换为项目现有的按键执行逻辑。
4. 正确处理组合键释放、旋钮快速连续操作和程序后台运行。

仓库根目录已经提供接收参考脚本：

```text
ImageFileSaveHttpServer.cs
```

该脚本已经支持远程键盘协议，并通过 Inspector 事件 `onRemoteKeyboardCommand(string)` 输出经过白名单校验的完整指令。Unity 团队不需要再创建第二个 `11701` HTTP 监听器，只需为这个事件连接实际的按键执行器。

## 2. 通讯总览

### 2.1 请求地址

```text
POST http://{艺术画廊IP}:{互动艺术端口}/
```

默认端口：

```text
11701
```

IP 和端口来自 iPad 首页的设置菜单。Unity 部署时，监听端口必须与 iPad 设置一致。iPad 与 Windows 主机需要位于能够互相访问的局域网中；iPad 端不能填写 `localhost` 或 `127.0.0.1`。

### 2.2 HTTP 格式

```http
POST / HTTP/1.1
Host: 192.168.x.x:11701
Content-Type: text/plain

MF|RemoteKeyboard|Press|{"keys":["Escape"]}
```

规则：

- 请求正文使用 UTF-8 纯文本。
- `Content-Type` 必须以 `text/plain` 开头；`text/plain;charset=UTF-8` 也有效。
- 指令前缀、动作名称、字段名和键名区分大小写。
- iPad 使用 fire-and-forget：发送后不会等待 Unity 的业务反馈，也不会重试或在画面显示接收状态。
- 接收端仍应尽快返回并关闭 HTTP 连接。当前参考脚本对合法文本指令返回 `202 Accepted`，非法指令返回 `400 Bad Request`。
- 每个 HTTP 请求只包含一条完整指令。

### 2.3 与现有 11701 功能共存

`11701` 目前同时承载：

| 内容 | `Content-Type` / 前缀 |
| --- | --- |
| 互动艺术图片上载 | `multipart/form-data` |
| 外部程序启动 | `text/plain`，`MF|AppLauncher|...` |
| 显示二维码 | `text/plain`，正文 `QrCode` |
| 远程键盘 | `text/plain`，`MF|RemoteKeyboard|...` |

接收端必须在同一个 HTTP 服务中按 `Content-Type` 和正文前缀分流。不要另外启动一个占用 `11701` 的键盘服务，否则会发生端口冲突，并导致图片上载或程序启动失效。

## 3. 指令类型

远程键盘只有两种指令：

```text
MF|RemoteKeyboard|Press|{JSON}
MF|RemoteKeyboard|Turn|{JSON}
```

当前协议没有版本号、请求 ID、时间戳、KeyUp 指令或 Unity 回执。每条合法请求应执行一次。

## 4. Press 按键指令

### 4.1 格式

```text
MF|RemoteKeyboard|Press|{"keys":["Escape"]}
```

JSON 数据结构：

```json
{
  "keys": ["Escape"]
}
```

`keys` 是一个有顺序的字符串数组。单键数组表示普通按键，多键数组表示一条不可拆分的原子组合键指令。

### 4.2 16 个按键完整映射

面板按从左到右、从上到下的顺序编号：

| 编号 | 面板含义 | `keys` 数组 | 完整请求正文 |
| ---: | --- | --- | --- |
| 1 | Escape | `["Escape"]` | `MF|RemoteKeyboard|Press|{"keys":["Escape"]}` |
| 2 | Home | `["Home"]` | `MF|RemoteKeyboard|Press|{"keys":["Home"]}` |
| 3 | Control + Shift | `["LeftControl","LeftShift"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftShift"]}` |
| 4 | Alt + F4 | `["LeftAlt","F4"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftAlt","F4"]}` |
| 5 | Space + N | `["Space","N"]` | `MF|RemoteKeyboard|Press|{"keys":["Space","N"]}` |
| 6 | Space + F | `["Space","F"]` | `MF|RemoteKeyboard|Press|{"keys":["Space","F"]}` |
| 7 | End | `["End"]` | `MF|RemoteKeyboard|Press|{"keys":["End"]}` |
| 8 | Page Down | `["PageDown"]` | `MF|RemoteKeyboard|Press|{"keys":["PageDown"]}` |
| 9 | 预设 1 | `["LeftControl","LeftAlt","Alpha1"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha1"]}` |
| 10 | 预设 2 | `["LeftControl","LeftAlt","Alpha2"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha2"]}` |
| 11 | 预设 3 | `["LeftControl","LeftAlt","Alpha3"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha3"]}` |
| 12 | 预设 4 | `["LeftControl","LeftAlt","Alpha4"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha4"]}` |
| 13 | 预设 5 | `["LeftControl","LeftAlt","Alpha5"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha5"]}` |
| 14 | 预设 6 | `["LeftControl","LeftAlt","Alpha6"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha6"]}` |
| 15 | 预设 7 | `["LeftControl","LeftAlt","Alpha7"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha7"]}` |
| 16 | 预设 8 | `["LeftControl","LeftAlt","Alpha8"]` | `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha8"]}` |

### 4.3 组合键执行规则

多键数组必须作为一个组合键执行，不能把数组中的每个键当作互不相关的点击。

推荐执行顺序：

1. 按数组顺序发送 KeyDown。
2. 最后一个键完成按下。
3. 按数组相反顺序发送 KeyUp。

例如 `LeftControl + LeftAlt + Alpha1`：

```text
KeyDown LeftControl
KeyDown LeftAlt
KeyDown Alpha1
KeyUp   Alpha1
KeyUp   LeftAlt
KeyUp   LeftControl
```

实现要求：

- 必须使用 `try/finally` 或等价机制保证所有已经按下的键最终都会释放。
- `Alt + F4` 可能关闭当前前台窗口，Unity 团队应确认指令最终注入的目标窗口符合现场需求。
- 当前协议不提供长按时长。iPad 上长按键帽不会持续发送重复指令；只有手指在键帽内正常抬起时才发送一次 `Press`。
- 如果目标程序需要短暂按住组合键，请在 Unity/Windows 执行层以非阻塞方式安排 KeyUp，不要在 Unity 主线程调用 `Thread.Sleep`。

## 5. Turn 旋钮指令

### 5.1 格式

```text
MF|RemoteKeyboard|Turn|{"control":"volume","key":"Plus","steps":2}
```

JSON 数据结构：

```json
{
  "control": "volume",
  "key": "Plus",
  "steps": 2
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `control` | string | 旋钮标识，只允许 `volume`、`vertical`、`horizontal` |
| `key` | string | 该方向对应的符号键名 |
| `steps` | integer | 本次累计档位数，范围 `1` 至 `32` |

### 5.2 三个旋钮映射

方向按用户正面观察旋钮时计算：

| 旋钮位置 | `control` | 逆时针 | 顺时针 |
| --- | --- | --- | --- |
| 右侧顶部小旋钮 | `volume` | `Minus` | `Plus` |
| 右侧中部小旋钮 | `vertical` | `UpArrow` | `DownArrow` |
| 右侧底部大旋钮 | `horizontal` | `LeftArrow` | `RightArrow` |

右侧底部大旋钮的中心圆盘同时是独立按键。只有按下中心圆盘时才触发，外圈刻度区域继续用于旋转；中心按键发送与 4 × 4 键盘第 16 键完全相同的指令：

```text
MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha8"]}
```

完整示例：

```text
MF|RemoteKeyboard|Turn|{"control":"volume","key":"Minus","steps":1}
MF|RemoteKeyboard|Turn|{"control":"volume","key":"Plus","steps":3}
MF|RemoteKeyboard|Turn|{"control":"vertical","key":"UpArrow","steps":2}
MF|RemoteKeyboard|Turn|{"control":"vertical","key":"DownArrow","steps":2}
MF|RemoteKeyboard|Turn|{"control":"horizontal","key":"LeftArrow","steps":4}
MF|RemoteKeyboard|Turn|{"control":"horizontal","key":"RightArrow","steps":4}
```

### 5.3 `steps` 的执行语义

`steps` 是重复点击次数，不是持续按住时间，也不是最终绝对值。

例如：

```json
{"control":"volume","key":"Plus","steps":3}
```

Unity 执行器应产生：

```text
Plus 点击一次
Plus 点击一次
Plus 点击一次
```

iPad 当前每旋转约 `15deg` 产生一个档位。同方向连续操作会在约 `38ms` 的短窗口内合并，因此慢速旋转通常收到多个 `steps: 1`，快速旋转可能收到一个较大的 `steps`。单条指令的最大值为 `32`；更长的快速旋转会拆成多条请求。

执行要求：

- 不要忽略 `steps`，也不要无论数值多少都只执行一次。
- 不要把 `steps` 当作百分比或旋钮绝对位置。
- 每次方向改变时，iPad 会先发送上一方向的累计值，再开始累计新方向。
- `Plus` 是协议中的符号键名。若目标程序需要主键盘上的 `+`，Windows 注入层可能需要转换为 `Shift + Equals`；若目标程序使用小键盘加号，则应转换为 `Numpad +`。具体物理键由 Unity 端现有控制逻辑决定，不能简单假定所有键盘库都存在名为 `Plus` 的键。
- `control` 与 `key` 必须匹配。合法组合之外的请求应拒绝，不应尝试自动纠正。

## 6. 合法值白名单

### 6.1 Press 键名

```text
Escape
Home
LeftControl
LeftShift
LeftAlt
F4
Space
N
F
End
PageDown
Alpha1 ... Alpha8
```

### 6.2 Turn 键名

```text
Minus
Plus
UpArrow
DownArrow
LeftArrow
RightArrow
```

白名单校验不仅检查键名，也检查数组长度、数组顺序以及 `control` 与 `key` 的对应关系。例如以下请求均为非法：

```text
MF|RemoteKeyboard|Press|{"keys":["LeftShift","LeftControl"]}
MF|RemoteKeyboard|Press|{"keys":["Alpha1","LeftControl","LeftAlt"]}
MF|RemoteKeyboard|Turn|{"control":"volume","key":"RightArrow","steps":1}
MF|RemoteKeyboard|Turn|{"control":"volume","key":"Plus","steps":0}
MF|RemoteKeyboard|Turn|{"control":"volume","key":"Plus","steps":33}
```

## 7. Unity 接入方式

### 7.1 接收组件

使用仓库根目录现有的 `ImageFileSaveHttpServer.cs`：

1. 将脚本放入 Unity 项目。
2. 在常驻场景中创建唯一的 HTTP 服务 GameObject。
3. 挂载 `ImageFileSaveHttpServer`。
4. Inspector 中把 `port` 设置为 `11701`，或与 iPad 设置页的互动艺术端口保持一致。
5. 保持 `keepRunningInBackground = true`。
6. 在 `onRemoteKeyboardCommand` 事件中绑定按键执行组件的公开方法，例如 `HandleRemoteKeyboardCommand(string)`。
7. 如果会切换 Unity 场景，HTTP 服务对象必须常驻并避免重复实例化；可使用 `DontDestroyOnLoad` 和单例保护。

参考脚本的线程模型：

```text
HttpListener 后台回调
        ↓
解析 JSON + 白名单校验
        ↓
ConcurrentQueue<string>
        ↓
Unity Update 主线程
        ↓
onRemoteKeyboardCommand(string)
        ↓
项目现有按键执行器
```

不要在 `HttpListener` 回调线程直接调用 Unity API、操作 GameObject 或触发场景切换。

### 7.2 执行器解析骨架

以下代码可作为 Unity 执行器的解析骨架。`ExecuteChord` 和 `ExecuteRepeatedKey` 内部应连接项目现有的 Windows 按键模拟或业务方法；示例本身不会注入系统按键。

```csharp
using System;
using UnityEngine;

public sealed class RemoteKeyboardCommandExecutor : MonoBehaviour
{
    private const string PressPrefix = "MF|RemoteKeyboard|Press|";
    private const string TurnPrefix = "MF|RemoteKeyboard|Turn|";

    [Serializable]
    private sealed class PressPayload
    {
        public string[] keys;
    }

    [Serializable]
    private sealed class TurnPayload
    {
        public string control;
        public string key;
        public int steps;
    }

    // Bind this method to ImageFileSaveHttpServer.onRemoteKeyboardCommand.
    public void HandleRemoteKeyboardCommand(string command)
    {
        if (string.IsNullOrWhiteSpace(command))
            return;

        if (command.StartsWith(PressPrefix, StringComparison.Ordinal))
        {
            string json = command.Substring(PressPrefix.Length);
            PressPayload payload = JsonUtility.FromJson<PressPayload>(json);
            if (payload?.keys == null || payload.keys.Length == 0)
                return;

            ExecuteChord(payload.keys);
            return;
        }

        if (command.StartsWith(TurnPrefix, StringComparison.Ordinal))
        {
            string json = command.Substring(TurnPrefix.Length);
            TurnPayload payload = JsonUtility.FromJson<TurnPayload>(json);
            if (payload == null || payload.steps < 1 || payload.steps > 32)
                return;

            ExecuteRepeatedKey(payload.control, payload.key, payload.steps);
        }
    }

    private void ExecuteChord(string[] orderedKeys)
    {
        // Project integration point:
        // KeyDown in array order, then KeyUp in reverse order.
        Debug.Log($"Remote chord: {string.Join(" + ", orderedKeys)}");
    }

    private void ExecuteRepeatedKey(string control, string key, int steps)
    {
        // Project integration point:
        // Tap the mapped key exactly 'steps' times without blocking Update().
        Debug.Log($"Remote turn: control={control}, key={key}, steps={steps}");
    }
}
```

### 7.3 按键注入注意事项

Unity 的 `Input` / `InputSystem` API用于读取输入，不等同于向 Windows 或其他应用发送键盘事件。若目标是控制当前 Unity 内部功能，推荐直接把协议键名映射到业务方法；若目标是控制其他前台程序，则应复用项目已有的 Windows `SendInput` 或同类执行模块。

两种实现方式：

| 目标 | 推荐方式 |
| --- | --- |
| 控制当前 Unity 场景 | 协议键名直接映射到 Unity 方法或 Input Action |
| 控制 Windows 前台程序 | 使用现有 Windows 键盘注入模块，并保证目标窗口焦点正确 |

无论采用哪一种方式，都必须保证组合键按顺序按下并反向释放，避免 `Control`、`Shift` 或 `Alt` 残留为按下状态。

## 8. Windows 部署要求

### 8.1 端口唯一占用

同一台 Windows 主机只能有一个进程监听 `11701`。检查端口：

```powershell
netstat -ano | findstr :11701
```

如果互动艺术图片接收、程序启动和键盘控制都在同一个 Unity 程序内，应统一使用 `ImageFileSaveHttpServer` 分流，不能为每个功能分别创建监听器。

### 8.2 防火墙

Windows 防火墙必须允许 Unity 程序或 TCP `11701` 的局域网入站连接。建议只开放 Private/Domain 网络，不要向公网开放。

### 8.3 HttpListener 权限

参考脚本监听：

```text
http://*:11701/
```

如果启动时报 `Access is denied`，需要以管理员身份运行，或由部署人员为运行账号配置 URL ACL。示例：

```powershell
netsh http add urlacl url=http://*:11701/ user=Windows用户名
```

实际部署账号和安全策略由现场运维确定。

### 8.4 后台运行

Unity 程序失去焦点后仍需要处理 iPad 指令，因此应保持：

```csharp
Application.runInBackground = true;
```

参考脚本已经通过 `keepRunningInBackground` 提供该设置。

## 9. 手工测试

将示例 IP 替换为运行 Unity 的 Windows 主机 IP。

### 9.1 测试单键

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri "http://192.168.8.101:11701/" `
  -ContentType "text/plain; charset=utf-8" `
  -Body 'MF|RemoteKeyboard|Press|{"keys":["Escape"]}'
```

预期：

```text
HTTP 202
Accepted
```

Unity Console：

```text
Remote keyboard command requested: MF|RemoteKeyboard|Press|{"keys":["Escape"]}
```

### 9.2 测试组合键

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri "http://192.168.8.101:11701/" `
  -ContentType "text/plain; charset=utf-8" `
  -Body 'MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha1"]}'
```

### 9.3 测试旋钮

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri "http://192.168.8.101:11701/" `
  -ContentType "text/plain; charset=utf-8" `
  -Body 'MF|RemoteKeyboard|Turn|{"control":"volume","key":"Plus","steps":3}'
```

预期：Unity 执行器将音量增加键执行 3 次，而不是只执行一次或持续按住。

### 9.4 测试非法请求

```powershell
Invoke-WebRequest `
  -Method Post `
  -Uri "http://192.168.8.101:11701/" `
  -ContentType "text/plain; charset=utf-8" `
  -Body 'MF|RemoteKeyboard|Turn|{"control":"volume","key":"RightArrow","steps":1}'
```

预期：

```text
HTTP 400
Invalid text command.
```

## 10. 联调验收清单

Unity 端完成开发后，至少验证以下项目：

- [ ] iPad 和 Windows 使用相同局域网，iPad 设置中的 IP 和端口正确。
- [ ] Unity 启动后 `11701` 只被一个进程占用。
- [ ] 16 个按键各执行一次，映射与表格完全一致。
- [ ] `LeftControl + LeftShift`、`Alt + F4`、`Space + N/F` 均作为组合键执行。
- [ ] `Control + Alt + Alpha1` 至 `Alpha8` 八组预设全部正确。
- [ ] 组合键执行后，`Control`、`Shift`、`Alt` 不会残留为按下状态。
- [ ] 音量旋钮逆时针为 `Minus`，顺时针为 `Plus`。
- [ ] 中部旋钮逆时针为 `UpArrow`，顺时针为 `DownArrow`。
- [ ] 底部旋钮逆时针为 `LeftArrow`，顺时针为 `RightArrow`。
- [ ] 底部大旋钮中心按下时执行 `Control + Alt + Alpha8`，外圈旋转不会误触该组合键。
- [ ] `steps: 1` 与大于 1 的快速旋转都按指定次数执行。
- [ ] 快速连续旋转时不丢档、不把多档错误执行成一次。
- [ ] Unity 失去焦点或切换场景后仍能接收指令。
- [ ] 非法键名、错误组合、错误 `control/key` 和超出范围的 `steps` 返回 `400`。
- [ ] 键盘指令不会影响同端口的互动艺术图片上载。
- [ ] 键盘指令不会影响同端口的程序启动和二维码指令。
- [ ] Unity 接收请求后立即返回，HTTP 连接不会长期占用。

## 11. 当前协议边界

- iPad 不接收 Unity 成功或失败反馈。
- iPad 不检查目标窗口是否处于前台。
- iPad 不负责确认 Windows 是否真正执行了按键。
- 协议没有长按、独立 KeyDown/KeyUp、宏延迟、设备 ID或请求去重字段。
- iPad 上的机械键盘按压声和旋钮刻度声只在 iPad 本地播放，不会发送给 Unity。
- Unity 不应根据面板颜色、图标或显示文字推断功能，应始终以收到的 `keys`、`control`、`key` 和 `steps` 为准。
- 如需增加按键、修改映射或加入回执，必须同步修改 iPad 的 `src/components/RemoteKeyboardPage.tsx`、`src/services/unityBridge.ts`、Unity 白名单和本文档。

## 12. 相关文件

```text
UNITY_REMOTE_KEYBOARD.md                 本文档
ImageFileSaveHttpServer.cs               Unity 11701 接收参考脚本
UNITY_INTERACTION.md                     MagicFloor 完整 Unity 交互协议
src/components/RemoteKeyboardPage.tsx    iPad 键盘与旋钮映射
src/services/unityBridge.ts              iPad HTTP 消息生成与发送
```

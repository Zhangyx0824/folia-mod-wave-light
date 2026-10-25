# folium-compound 模组提交 · 粘贴用文案

> **最快的方式**：打开 `SUBMIT.md` 里的预填链接，表单各栏已填好，只需**把真实截图拖进「运行截图」框**、勾上「确认」三项、提交。
> （整条 URL 有 7 千多字符，单独放在 `SUBMIT.md`，不适合直接贴在这里。）

新建 issue 地址：https://github.com/chthollyphile/folium-compound/issues/new?template=mod-submission.yml
（若为更新，用 https://github.com/chthollyphile/folium-compound/issues/new?template=mod-update.yml ，标题 `[模组更新] 动感波光 wave-light`）

标题：`[模组提交] 动感波光 wave-light`

## 模组 id / Mod id

```
wave-light
```

## 源码仓库 / Source repository

```
https://github.com/Zhangyx0824/folia-mod-wave-light
```

## 版本 / Version (tag or commit)

```
v1.5.1
```

## 模组目录 / Mod directory

```
wave-light
```

## 发布渠道 / Channel

选「正式发布 / Release」

## 模组说明 / Description

```
一个歌词动画模式「动感波光」：在播放界面的动画模式选择器里选中它时，播放页变成一片随当前歌曲封面主色呼吸的暗色水面——左右两侧各有一组像喇叭声波一样逐环放大缩小、缓缓转动的同心圆波纹，颜色全部由封面主色派生；当前句歌词居中放大，背后浮着一行取自该句歌词的超大关键字水印，外语歌的翻译在屏幕下方单独成块显示。

效果参考 QQ 音乐的「动感波光」播放页。不选中该模式时完全不渲染，与内置及其他模组的歌词样式互不影响。

关键字水印的选词与宿主内置 sonnet 排版引擎同源：整句先用 Intl.Segmenter 按词切分（无该能力时回退到「拉丁整词 / 中日文逐字」），再按 min(字数,8)×14 + min(2.5s, 演唱时长)×18 给每个词打分，权重最高者上屏（宿主只给行级时间，词的演唱时长按字数占比从行时长分摊）；同分词由整句哈希稳定抉择，句内不变、句间不同。单字胜出时向更重的邻词借字，保证水印始终是 ≥2 字的连贯片段；署名行（作词：/ 混音：等）显示最后一个冒号后的内容。

可调项：波光配色（封面主色 / 主题色）、波光亮度（0.3–2）、流动速度（0.2–3）、关键字水印开关、歌词字号。

实现：通过公开注册表 folium.registries.visualizers 注册一个动画模式（hostLayers: { background: false, subtitles: false }，背景与歌词均由模组自绘）。背景为封面主色派生的径向暗色渐变（DOM），双声波为单个 canvas 用 requestAnimationFrame 每帧绘制（加法混合，DPR 上限 1.75），歌词 / 水印 / 翻译为 DOM 文本，走主题字体。封面主色在本机对封面做 24×24 降采样提取，不联网。文本层居中采用「实测自校正」：先复位到自然位置，测量实际落点后向容器可见中心做差值修正，因此在播放页与设置面板的小卡片预览里都能正确居中。
```

## 权限说明 / Permissions

```
无。mod.json 的 permissions 为空数组 []，未声明 embedOrigins，也未使用任何 experimental 接口。模组只使用动画模式注册表（visualizers）与宿主提供的上下文读取（lines / onLyricTime / getLineIndex / getCoverUrl / isPaused / getTheme / getDisplay / onResize / onChange），不需要 stageLayers、playback.*、net.fetch、filesystem.data 或 platform.*；不联网、不上传用户数据、不碰宿主 DOM、不注入全局样式。唯一写入的是宿主代为保存的模式设置。
```

## 许可证 / License

```
MIT
```

## 运行截图 / Screenshot

必须**把图片直接拖进这个输入框上传**（外部链接不算，CI 只认 github.com/user-attachments 的地址）。

建议截图内容：Folia 播放页选中「动感波光」模式、正常显示波纹 + 居中歌词 + 水印；最好能带上 Folia 版本号（0.7.21）。

> 注意：仓库里的 `wave-light/preview.jpg` 是按实机效果绘制的示意图，不是应用截图——issue 里请另附一张真实截图。

## 确认 / Confirmations

三项全部勾选（不收集或上传用户数据，也不下载并执行远程代码）。

---

## 提交后的流程

1. CI 自动检查并回复「格式检查通过，请等待维护者审查」，并附将要签名的文件清单。
2. 维护者审查代码与权限声明。
3. 维护者评论 `/sign <commit>` → CI 签名、复制进 folium-compound、发布到模组市场，issue 自动关闭。

---

## 本次提交内容（v1.5.1）

- 关键字水印选词：移植内置 sonnet 排版引擎的「英雄词」打分逻辑（按词切分 → 字数 ×14 + 演唱时长 ×18 → 取最重），不再是随机 2–4 字。
- 修复设置面板「歌词样式」预览里排版错乱：居中不再锚定浏览器视口，改为实测每层文字落点后向本容器可见中心做差值修正。
- 居中大歌词 + 逐字入场动效（中心字先由模糊变清晰，两侧字同时从左右靠拢汇入）。
- 翻译独立成块，位于水印底缘与屏幕底部的中点，随水印大小自适应。
- 左右双声波：同心圆逐环放大缩小 + 由内向外推进的发光脉冲环 + 旋转亮弧，颜色取封面主色。

## 本地预检结果（2026-10-26）

- 模组目录 `wave-light/`：4 个文件（mod.json / client.mjs / preview.jpg / LICENSE），约 110 KB，无 `folium.sig.json`、无符号链接
- 预览图：1280×720 JPEG，55 KB（市场要求 ≤1 MB，16:9）
- `permissions: []`、`folia: ">=0.7.21 <0.8.0"`（本机 Folia 0.7.21 在范围内）
- 冒烟测试 `test/smoke.mjs`：27/27 通过（注册与 hostLayers、按词选水印、署名行取冒号后内容、翻译独立成块、逐字 span 位移与错峰、水印开关、静态模式、预览卡片对齐修正、包含块正确时不位移）
- 已在本机 Folia 0.7.21 实机播放验证（sync.sh 同步 + digest 预授权）

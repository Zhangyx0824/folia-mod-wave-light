# 模组更新 · v1.6.0（适配 Folia 0.8.0）

wave-light 已签名收录（初次提交 issue #93，`mods/community/wave-light`，当前版本 1.5.1）。
本次是**新版本更新**，走 `mod-update.yml` 表单；不需要截图、不需要填仓库与目录，CI 会从登记的源码仓库取回 `v1.6.0` 并与 1.5.1 对比。

## 预填链接（打开后只需勾一项确认再提交）

https://github.com/chthollyphile/folium-compound/issues/new?template=mod-update.yml&title=%5B%E6%A8%A1%E7%BB%84%E6%9B%B4%E6%96%B0%5D%20%E5%8A%A8%E6%84%9F%E6%B3%A2%E5%85%89%20wave-light&mod-id=wave-light&ref=v1.6.0&channel=%E4%BF%9D%E6%8C%81%E4%B8%8D%E5%8F%98%20%2F%20Keep%20current&category=%E4%BF%9D%E6%8C%81%E4%B8%8D%E5%8F%98%20%2F%20Keep%20current&changes=%E9%80%82%E9%85%8D%20Folia%200.8.0%EF%BC%88Folium%201.10%20%2F%20%E5%AE%BF%E4%B8%BB%E5%86%85%E9%83%A8%202.1%EF%BC%89%EF%BC%9A%0A%0A1.%20mod.json%20%E7%9A%84%20folia%20%E8%8C%83%E5%9B%B4%E4%BB%8E%20%22%3E%3D0.7.21%20%3C0.8.0%22%20%E6%94%B9%E4%B8%BA%20%22%3E%3D0.8.0%22%EF%BC%8C%E7%89%88%E6%9C%AC%E5%8D%87%E5%88%B0%201.6.0%E3%80%82%E6%97%A7%E7%9A%84%E4%B8%8A%E9%99%90%E4%BC%9A%E8%AE%A9%E5%AE%BF%E4%B8%BB%E5%9C%A8%200.8.0%20%E4%B8%8A%E5%88%A4%E5%AE%9A%E6%A8%A1%E7%BB%84%E4%B8%8D%E5%85%BC%E5%AE%B9%E3%80%81%E7%9B%B4%E6%8E%A5%E4%B8%8D%E5%8A%A0%E8%BD%BD%EF%BC%8C%E5%9B%A0%E6%AD%A4%E8%BF%99%E6%98%AF%E5%BF%85%E8%A6%81%E4%BF%AE%E5%A4%8D%EF%BC%9B%E6%9C%80%E4%BD%8E%E5%AE%BF%E4%B8%BB%E7%89%88%E6%9C%AC%E7%9B%B8%E5%BA%94%E6%8F%90%E5%8D%87%E4%B8%BA%200.8.0%E3%80%82%0A2.%200.8.0%20%E6%8A%8A%E5%85%AC%E5%BC%80%20song%20DTO%20%E7%BC%A9%E5%87%8F%E4%B8%BA%20%7Bid%2Ctitle%2Cartist%2Calbum%2Csource%2Cref%7D%EF%BC%88%E7%A7%BB%E9%99%A4%20duration%E3%80%81coverUrl%E3%80%81artists%5B%5D%EF%BC%89%E3%80%82%E6%9C%AC%E6%A8%A1%E7%BB%84%E5%8F%AA%E8%AF%BB%E5%8F%96%20song.title%EF%BC%88%E5%BC%80%E5%A4%B4%E6%97%A0%E6%AD%8C%E8%AF%8D%E6%97%B6%E6%98%BE%E7%A4%BA%E6%AD%8C%E5%90%8D%EF%BC%8C%E5%B9%B6%E5%85%BC%E5%AE%B9%E6%97%A7%20name%20%E5%AD%97%E6%AE%B5%EF%BC%89%EF%BC%8C%E5%B0%81%E9%9D%A2%E8%B5%B0%E7%8B%AC%E7%AB%8B%E7%9A%84%20ctx.getCoverUrl%28%29%20%E9%80%9A%E9%81%93%EF%BC%8C%E6%AD%8C%E8%AF%8D%E6%97%B6%E9%95%BF%E6%9D%A5%E8%87%AA%20ctx.lines%5B%5D.startTime%2FendTime%EF%BC%8C%E5%9D%87%E4%B8%8D%E5%8F%97%20DTO%20%E7%BC%A9%E6%B0%B4%E5%BD%B1%E5%93%8D%EF%BC%8C%E5%9B%A0%E6%AD%A4%E4%B8%8D%E9%9C%80%E8%A6%81%20folium.internals%EF%BC%8C%E4%B9%9F%E6%B2%A1%E6%9C%89%E6%96%B0%E5%A2%9E%E6%9D%83%E9%99%90%E3%80%82%0A3.%20activate%28%29%20%E5%90%AF%E5%8A%A8%E6%97%B6%E6%89%93%E5%8D%B0%E5%AE%BF%E4%B8%BB%E7%89%88%E6%9C%AC%E6%97%A5%E5%BF%97%EF%BC%88Folia%200.8.0%20%2F%20%E6%A8%A1%E7%BB%84%20API%201.10%EF%BC%89%EF%BC%8C%E4%BE%BF%E4%BA%8E%E4%BB%A5%E5%90%8E%E6%8E%92%E6%9F%A5%E7%89%88%E6%9C%AC%E9%97%AE%E9%A2%98%E3%80%82%0A4.%20%E5%86%92%E7%83%9F%E6%B5%8B%E8%AF%95%E6%96%B0%E5%A2%9E%200.8.0%20%E5%9C%BA%E6%99%AF%EF%BC%88%E6%B8%85%E5%8D%95%E8%8C%83%E5%9B%B4%E3%80%810.8%20DTO%20%E6%B8%B2%E6%9F%93%E3%80%81%E5%90%AF%E5%8A%A8%E6%97%A5%E5%BF%97%EF%BC%89%EF%BC%8C%E5%85%B1%2032%2F32%20%E9%80%9A%E8%BF%87%EF%BC%9B%E5%AE%98%E6%96%B9%20validateManifest%20%E4%B8%8E%20checkPreview%20%E6%A0%A1%E9%AA%8C%E9%80%9A%E8%BF%87%EF%BC%9B%E5%B7%B2%E5%9C%A8%E6%9C%AC%E6%9C%BA%20Folia%200.8.0%20%E5%90%8C%E6%AD%A5%E5%B9%B6%E9%87%8D%E6%96%B0%E6%8E%88%E6%9D%83%E3%80%82%0A%0A%E6%9D%83%E9%99%90%E6%97%A0%E5%8F%98%E5%8C%96%EF%BC%9Apermissions%20%E4%BB%8D%E4%B8%BA%E7%A9%BA%E6%95%B0%E7%BB%84%20%5B%5D%EF%BC%8C%E4%B8%8D%E8%81%94%E7%BD%91%E3%80%81%E4%B8%8D%E4%B8%8A%E4%BC%A0%E7%94%A8%E6%88%B7%E6%95%B0%E6%8D%AE%E3%80%81%E4%B8%8D%E4%B8%8B%E8%BD%BD%E5%B9%B6%E6%89%A7%E8%A1%8C%E8%BF%9C%E7%A8%8B%E4%BB%A3%E7%A0%81%E3%80%82%E8%A7%86%E8%A7%89%E6%95%88%E6%9E%9C%E3%80%81%E8%AE%BE%E7%BD%AE%E9%A1%B9%E4%B8%8E%E9%A2%84%E8%A7%88%E5%9B%BE%E5%9D%87%E6%97%A0%E5%8F%98%E5%8C%96%E3%80%82

> GitHub 应用无法在 folium-compound 建 issue（第三方仓库只读，403），所以表单要由本人提交。
> 链接已填好标题、模组 id、版本、发布渠道、分类和更新说明；**唯一要手动做的是勾选「确认 / Confirmations」那一项**。
>
> ⚠ 提交前扫一眼两个下拉框：**「发布渠道」应为「保持不变 / Keep current」、「分类」应为「保持不变 / Keep current」**。
> GitHub 表单有个坑：URL 带了参数时，没显式写进 URL 的下拉会被清成「无」；渠道留空会让 CI 报「只能是正式发布或先行测试」。
> 如果显示不对（或长 URL 被浏览器截断导致「更新说明」为空），就从下面「各栏文案」手动粘贴、手动选下拉。

## 各栏文案（万一链接不好用，手动粘贴）

标题：`[模组提交]` 改成 **`[模组更新] 动感波光 wave-light`**

### 模组 id / Mod id

```
wave-light
```

### 版本 / Version (tag or commit)

```
v1.6.0
```

### 发布渠道 / Channel

```
保持不变 / Keep current
```

### 分类 / Category

```
保持不变 / Keep current
```

### 更新说明 / What changed

```
适配 Folia 0.8.0（Folium 1.10 / 宿主内部 2.1）：

1. mod.json 的 folia 范围从 ">=0.7.21 <0.8.0" 改为 ">=0.8.0"，版本升到 1.6.0。旧的上限会让宿主在 0.8.0 上判定模组不兼容、直接不加载，因此这是必要修复；最低宿主版本相应提升为 0.8.0。
2. 0.8.0 把公开 song DTO 缩减为 {id,title,artist,album,source,ref}（移除 duration、coverUrl、artists[]）。本模组只读取 song.title（开头无歌词时显示歌名，并兼容旧 name 字段），封面走独立的 ctx.getCoverUrl() 通道，歌词时长来自 ctx.lines[].startTime/endTime，均不受 DTO 缩水影响，因此不需要 folium.internals，也没有新增权限。
3. activate() 启动时打印宿主版本日志（Folia 0.8.0 / 模组 API 1.10），便于以后排查版本问题。
4. 冒烟测试新增 0.8.0 场景（清单范围、0.8 DTO 渲染、启动日志），共 32/32 通过；官方 validateManifest 与 checkPreview 校验通过；已在本机 Folia 0.8.0 同步并重新授权。

权限无变化：permissions 仍为空数组 []，不联网、不上传用户数据、不下载并执行远程代码。视觉效果、设置项与预览图均无变化。
```

### 确认 / Confirmations

勾唯一一项（新版本同样不收集或上传用户数据，也不下载并执行远程代码）。

---

提交后 CI 回复「格式检查通过，请等待维护者审查」并给出与 1.5.1 的对比链接；维护者评论 `/sign <commit>` 即签名发布。
14 天内格式检查未通过且没有回应的 issue 会被自动关闭；如需再改版本，请编辑同一个 issue。

## 发布前已完成的动作

- `wave-light/mod.json`：version 1.6.0，`folia: ">=0.8.0"`
- `wave-light/client.mjs`：启动版本日志 + `song.title ?? song.name` 双兼容 + 0.8 DTO 注释
- `test/smoke.mjs`：新增 0.8.0 场景，32/32 通过
- 官方 `validateManifest` → `ok: true`；`parseHostRange(">=0.8.0")` → 0.8.0/0.8.1 满足、0.7.21 不满足
- `./sync.sh` 同步到本机 Folia 0.8.0，digest 已重算并写入 `mod-system.json`
- git tag `v1.6.0` 已推送到 https://github.com/Zhangyx0824/folia-mod-wave-light

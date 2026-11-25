# 第三方许可说明

KeyHeat3D 使用 `uiohook-napi` 1.5.5 采集键鼠按下事件。其 MIT 许可的 Node.js 包装层将 libuiohook 静态链接到原生模块。libuiohook 由 Alexander Barker 等作者开发，按 LGPL-3.0-or-later 分发。

- libuiohook [作者名单](third-party/libuiohook/AUTHORS)、[GNU GPL v3](third-party/libuiohook/COPYING.md) 和 [GNU LGPL v3](third-party/libuiohook/COPYING.LESSER.md)
- [发行版对应源码 ZIP](https://github.com/ShepiTT/KeyHeat3D/releases/download/v0.2.0/uiohook-napi-1.5.5-source.zip) 包含包装层、构建配置和随 1.5.5 发布的 libuiohook 源码，保留该版本对上游源码的修改。材料来自 [npm 1.5.5 包](https://registry.npmjs.org/uiohook-napi/-/uiohook-napi-1.5.5.tgz)和[包装层上游提交](https://github.com/SnosMe/uiohook-napi/tree/44e0d868ac6fedd2a68c7f8ad8163c73a3f36fc3)。
- Electron 和 Chromium 的许可证在免安装包内的 `LICENSE.electron.txt` 和 `LICENSES.chromium.html`，对应版本为 [Electron 33.4.11](https://github.com/electron/electron/tree/v33.4.11)。其他运行依赖的版本记录在 `package-lock.json`，许可证随各包分发。
- 界面本地字体使用 SIL Open Font License 1.1，各字体的许可文本随 [字体文件](src/renderer/fonts/) 分发。

## 在 Windows x64 重建原生模块

准备 x64 Node.js 22、Python 和带桌面 C++ 工作负载及 Windows SDK 的 Visual Studio Build Tools。工具要求见 [node-gyp 的 Windows 文档](https://github.com/nodejs/node-gyp/tree/v11.5.0#on-windows)，目标版本和头文件参数见 [Electron 原生模块构建文档](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules#manually-building-for-electron)。

1. 解压源码 ZIP，进入 `uiohook-napi-1.5.5-source` 目录。修改所需的 libuiohook 源码后执行：

   ```powershell
   npx --yes node-gyp@11.5.0 rebuild --target=33.4.11 --arch=x64 --dist-url=https://electronjs.org/headers
   ```

2. 将该目录与 KeyHeat3D 仓库放在同一个父目录。检出与目标 EXE 版本一致的 KeyHeat3D 标签，安装锁定的依赖后替换原生模块：

   ```powershell
   npm ci
   Copy-Item -LiteralPath '..\uiohook-napi-1.5.5-source\build\Release\uiohook_napi.node' `
     -Destination 'node_modules\uiohook-napi\prebuilds\win32-x64\uiohook-napi.node' -Force
   npm start
   ```

3. 验证自建模块后从托盘选择「完全退出」，执行 `npm run dist`，生成使用该模块的免安装版。

libuiohook 的相关修改和为调试这些修改而进行的逆向工程可按 LGPL 的条款进行。

// 预加载钩子：在普通 Node 里伪造 node:sea.getAsset，以便测试真实的 SEA 启动垫片
const Module = require('node:module');
const assets = JSON.parse(process.env.SEA_STUB_ASSETS || '{}');
const load = Module._load;

Module._load = function (request, parent, isMain) {
    if (request === 'node:sea') {
        return { getAsset: (key) => (key in assets ? Buffer.from(assets[key]) : null) };
    }
    return load.call(this, request, parent, isMain);
};

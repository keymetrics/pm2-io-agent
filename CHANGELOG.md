# Changelog

## v0.5.4 (25/06/2018)
- [version: patch bump to 0.5.4](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/fe2ab1b41bb9253f077c683339b33fec67cca385) - @Eywek
- [improv: fix leak](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/fa9ecd9ebfa07da69f72920901bf77b33ee19dda) - @Eywek

---

## v0.5.3 (25/06/2018)
- [version: patch bump to 0.5.3](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/9cc4354e83a9be29a46580d418dd40709d844815) - @Eywek
- [improv: add signal handlers to enable profiling #75](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/711424b356f0cda85531ebd4bc62720f4c6f50af) - @vmarchaud
- [improv: cleanup useless vars and fix output functions](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/c3ef347847f350166073f45adf27723b9bfc9211) - @Eywek
- [improv: fix active transporters #74](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/0acf4142521676fc30d63888a3f07cd91e7a4dc9) - @Eywek
- [improv: move websocket error listener #78](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/bb977bd6e6f1a2ccfb329b250ac56e21974d707c) - @Eywek
- [improv: fix debug prefix](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/b619bf1c612cc5469cd159562317198342f14556) - @Unitech
---

## v0.5.2 (25/06/2018)
- [version: patch bump to 0.5.2](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/24b70b2f6ba61232305bfb854e73e3d0f587b49e) - @Eywek
- [improv: fix ws connect() method for reconnects](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/63e541dd1d6b755056e332b37966ad7b5c646069) - @Eywek
- [improv: delay the logging timeout when calling starting it multiple times](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/df2940780b30b1d46549d0e567d632c5aa71922e) - @BenoitZugmeyer
- [improv: fix crash #72](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/0ad1598dbec6489090e6ec23f25cbf3826d89c6a) - @Eywek
- [feat: add pm2 reverse actions available #69](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/da042bfa41ab75391590d27f3ffbcfedbe948d84) - @Eywek
- [improv: use process_id instead of process_name for broadcast logs #70](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/b16dab1dc8f08f4be85f240c534f4a0978f1fb6c) - @Eywek

---

## v0.5.1 (04/06/2018)
- [version: patch bump to 0.5.1](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/1b0e099a50547c1a4ba5dcadeac1708653c106bf) - @vmarchaud
- [improv: background reconnect #66](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/f493817fec55fd06afb276ce63333294842164de) - @Eywek

---

## v0.5.0 (31/05/2018)
- [version: minor bump to 0.5.0](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/bc5547c0975171b2d93ad8038b41c07a97e90271) - @vmarchaud
- [improv: buffer data when not connected](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/11dc96b6ef945347ee28bdb314cacca939f4988d) - @Eywek
- [improv: add km_monitored handle](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/8b2a8c2a4b4d8d7dfa82222453c5f9645bcec0fd) - @Eywek
- [improv: use pub instead of pub-emitter for axon, stop handling manual reconnection](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/a5b85d97d81856dd7853189e4401feec7026e0e5) - @Eywek
- [improv: remove queue handle on axon](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/f25c07a7e178d10d2666d7b181105fd47b7694b6) - @Eywek
- [improv: edit json5 handle](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/6a08dafa224ac6177eba46a7355f9bb2f737a10e) - @Eywek
- [improv: use old logic for axon](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/733d4829cee5815a0ad04191710c691f9c7e3af2) - @Eywek
- [improv: fix reconnection with axon #58](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/5f3dfd8b67b0b35d61a1e2e4dbe174cd36fb9805) - @Eywek
- [improv: fix #43 watchdog](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/52ec50515a2fec77d0621b50dc471ecba5242c89) - @Eywek
- [improv: fix #58 agent queue](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/f9770963a48f426fdc224fb9bbf23379f2eec4cc) - @Eywek
- [improv: fix #48 for old agent](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/215a1188d186637aed0c86be7b977e86a89960e5) - @Eywek
- [improv: update 2 to 4 logs on exception #60](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/d520a28d0f29965796ecd7fcdc21007c6a0ff492) - @Eywek
- [improv: use logs instead of console.log](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/3ce5c3ba4a1382eb4b5a4f9a789acd90ae2a0fe5) - @Alexandre Strzelewicz
- [feat: keep ws conf](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/964b834f1788491b75a536a2f8a275d1c1b9a3c8) - @Alexandre Strzelewicz
- [chore: add coverage, use codeclimate](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/059ed419c93b13067c2bb4619d4a2b58516b1439) - @Eywek
- [fix: fix #49, logs buffer](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/ebb54be3ff34ab0357a637316781156ca43aa9d4) - @Eywek
- [axon: handle reconnection ourselves #52](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/c7dc5b33d3cce879fa0886a22d27019d8e2eb052) - @vmarchaud
---

## v0.4.2 (04/06/2018)
- [version: patch bump to 0.4.2](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/551756d069a0c84e64cd5f7f5fbd635e6eb2abaa) - @vmarchaud
- [transaction: export startTime for each span #50](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/521cbc3cbc4d8931cade0319dffdfd2be8a2aa8b) - @vmarchaud
- [ci: add node 10](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/171edf61683282b350b7cc4525604093bf89f4ff) - @vmarchaud

---

## v0.4.1 (15/05/2018)
- [meta: add agpl3 license](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/d0449fe6a729b8ef9741c0e4c4c14bf24bd7e978) - @vmarchaud
- [meta: rename npm name #47](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/e710ad34eb41444965aff225cbdf021ce2494ff5) - @vmarchaud
- [version: patch bump to 0.4.1](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/2f1f07c6b3d525641534095ca720de2784aa071c) - @vmarchaud
- [daemon: catch error and restart itself #42](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/a722234e62d79d36ec3b6de21854f1e913ee4970) - @Unitech
- [fix: verify connectivity on axon socket #41](https://api.github.com/repos/keymetrics/pm2-io-agent/git/commits/b632712ea8f4cd08aa847611ffc23ff1f43b06a3) - @Unitech

---

## v0.4.0 (30/04/2018)
- [feat: use pm2_env for broadcast logs](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/9978cea528b775f0811c39e3af52be8348dc3c55) - @Eywek
- [improv: fix getActiveTransporters() method](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/f3811a662afcd9f1bc8277834b26596a523e86a6) - @Eywek
- [improv: isConnected() using axon buffer and nssocket waiting retry, fix #35](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/d2e7d08c73bd5192e0dfd643eec78c30248b699d) - @Eywek

---

## v0.3.5 (30/04/2018)
- [version: patch bump to 0.3.5](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/3c70564a3258f8d7f1319963a131814732f8c254) - @vmarchaud
- [ci: remove node 10 (still not available)](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/45e34487b24fdc1ff72ea9c821cd1cff97e8706c) - @vmarchaud
- [chore: bugfix getInfos RPC request #34](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/fe3754bf8f859a690caf47377ae6d6f374a03db9) - @vmarchaud
- [improv: read profiling file as raw](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/28e82813bd8b8033c0bd4f8e5c042442219f3ab6) - @Eywek
- [improv: edit default websocket endpoint](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/e64f49f5dc0978215dabbc9836251a2bf28d0447) - @Eywek
- [fix: set DAEMON_ACTIVE to true when successfully connected](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/ddf44f3358c41480d9cf63f66e14fa1ad7525982) - @Unitech
- [chore: up pm2-axon-rpc](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/c5ad2a2aee45b54a4aa608d838f0eb5eec121983) - @Unitech
- [ci: add node 10](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/f21612599911ef6416e054597e62d797ff63ce76) - @Unitech
- [improv: fixs units tests](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/5a5dbaf71e3fa49ef0287e300f1e15af037b556c) - @Eywek

---

## v0.3.4 (25/04/2018)
- [version: patch bump to 0.3.4](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/c75c4c4e665acd6a1a4f373f3ca334d9269ddbaf) - @Eywek
- [improv: add internal_ip](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/ebb8e1a66cf1cdcec31be00dd870e910f45c992a) - @Eywek
- [improv: use ping() and pong() method for heartbeat #29](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/3e186fbd6ac6ad78b4ff584f8e609b44d44e4144) - @Eywek
- [axon: let nssocket & axon handle their reconnection](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/44945600f1e613ceb49477c936c5f9809e696818) - @vmarchaud

---

## v0.3.3 (23/04/2018)
- [improv: fixs some crashs / add heartbeat & some fixs/debugs #26 #27 #29](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/8866f1ee6d4b834a8c86875225ac307940ee136e) - @Eywek
- [profiling: send cpu/memory profile on one channel](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/76d7e7337bafb84c3db0414cf57413fa4ec4ee10) - @vmarchaud
- [chore: broadcast unique process_id + add unique_id for server](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/7e8dc512bce304fdb126d594d822c180691993ec) - @vmarchaud

---

## v0.3.2 (28/03/2018)
- [version: patch bump to 0.3.2](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/aa4e7ad5f214faddd4e00a3cbc28f2bc73764ede) - @vmarchaud
- [interactor: handle errors from handshake + enable log by default](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/36bfac7162c1f6a0b13be45f56acb6481972dbd4) - @vmarchaud
- [meta: document releasing of new version](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/36a130847ec3a6cbbcd1bfe2aeeff1e6d416e861) - @vmarchaud

---

## v0.3.1 (27/03/2018)
- [version: minor bump to 0.3.1](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/9dd93ff6c918e8de1939195c55f43b7cf2421b9f) - @vmarchaud
- [ci: add node 9 in test](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/0c4e9a154fc5644afd3d0e8117c322b37fce6462) - @vmarchaud
- [fix: skip a test on node 7](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/8660ec5a512f9591fc892df5360e3307552f1b0e) - @vmarchaud
- [tests: ignore some tests in node 4](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/f4b0b96793a1a1336f98305cf911319bdf4cd2ed) - @vmarchaud
- [fix: use url.parse for node 4](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/f591f439580a293fd3779e9ce95641502beae243) - @vmarchaud
- [fix: remove destructing object since not available in node 4](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/e95695aec1d4105b6806a834111eed628c8ac80a) - @vmarchaud
- [fix: remove destructing array since not available in node 4](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/8182ddab9e74572aa543704b5f0026d7ae95d91a) - @vmarchaud
- [fix: remove default args since not available in node 4](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/a754aeeac463dd69eb3b3ef063409bf695c106f3) - @vmarchaud
- [ci: remove coverage cause instability](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/4a588be281ad24bad13d61fd6e7619bd1d7bd96f) - @vmarchaud
- [meta: add use strict everywhere for node 4 + remove copyrights in files](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/b91b3dff271a2224b658ec0d614300985f3802a2) - @vmarchaud
- [ci: add matrix build for node version + npm publish](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/6be996dd05c4610afc85b5053f5b4486560cae06) - @vmarchaud
- [transporters: fix env variables for config](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/259ef096fd9f80ccc8cf50a10126b374a0b152a0) - @vmarchaud
- [chore: add readme](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/ac504b51a05a822233fc6c14ffb40c20f3384bd1) - @Eywek
- [review: edit pm2 interface dump](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/6257bf1b897c5b3c07abbd2d291509872fa11aee) - @Eywek
- [chore: merge master](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/8ee95daf2635c57e92480256cf1a52e4905a46d6) - @Eywek
- [chore: add watchdog](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/6b2514d998ea77bc9fb954827f4b58dc80252872) - @Eywek
- [improv: add tests on pm2 interface](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/f3836ef343e488271abf65d59449493ec5649f20) - @Eywek
- [improv: add tests on transporter interface](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/98c32c51ed36fe8dc695aa551e677ae38f6abcf4) - @Eywek
- [improv: add tests on pm2 interface](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/4f10759706a53f4b503c409123a77c3e32d847cf) - @Eywek
- [improv: add tests on transporter interface](https://api.github.com/repos/keymetrics/keymetrics-agent/git/commits/8c07a09acacb68aedd15e91a26c2a52f547e750b) - @Eywek

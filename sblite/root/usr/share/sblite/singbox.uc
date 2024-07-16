'use strict';

import { popen, open as fopen } from 'fs';
import { LOG_PATH, DB_PATH, CONFIG_PATH } from './const.uc';
import { CLASH_PORT } from './default.uc';

function version() {
    let result = {
        version: 'unkown',
        features: {},
    };

    const handle = popen('/usr/bin/sing-box version');

    if (handle) {
        for (let line = handle.read('line'); length(line); line = handle.read('line')) {
            line = trim(line);

            let tags = match(line, /Tags: (.*)/);
            if (tags) {
                for (let i in split(tags[1], ',')) {
                    result.features[i] = true;
                }

                continue;
            }

            let version = match(line, /sing-box version v(.*)/);
            if (version) {
                result.version = split(version[1], ' ')[0];
            }
        }

        handle.close();
    }

    return result;
}

export function SingBoxOption() {
    return proto({
        log: {},
        dns: {},
        inbounds: [],
        outbounds: [],
        route: {},
        experimental: {},
    }, {
        version: version(),

        logOption: function (enable, level) {
            if (enable) {
                this.log.timestamp = true;
                this.log.level = level;
                this.log.disabled = false;
                this.log.output = LOG_PATH;
            } else {
                this.log.disabled = true;
                delete this.log.level;
                delete this.log.output;
                delete this.log.timestamp;
            }
        },
        cacheFileOption: function (enable) {
            if (enable) {
                this.experimental.cache_file = {
                    enabled: true,
                    path: DB_PATH,
                    store_fakeip: true,
                };
            } else {
                this.experimental.cache_file = {
                    enabled: false,
                };
            }
        },

        clashOption: function (option) {
            // 必须传入 option 的同时 singbox 编译附带了 clash api 选项才能配置 
            if (!option || !this.version.features.with_clash_api) {
                delete this.experimental.clash_api;

                return;
            }

            let port = int(option.port);

            if (port == 'NaN' || port < 0 || port > 65535) {
                port = CLASH_PORT;
            }

            let host = option.host;
            let ui = option.ui;
            let download_url = option.download_url;
            let download_detour = option.download_detour;
            let secret = option.secret;
            let default_mode = option.default_mode;

            this.experimental.clash_api = {
                external_controller: host + ':' + port,
                external_ui: ui,
                external_ui_download_url: download_url,
                external_ui_download_detour: download_detour,
                secret: secret,
                default_mode: default_mode,
            };

            return;
        },

        write: function () {
            const fp = fopen(CONFIG_PATH, 'w');

            if (fp) {
                fp.write(this);
                fp.write('\n');
                fp.close();
            }

            system(sprintf('sing-box format -w -c %s', CONFIG_PATH));
        }
    });
};

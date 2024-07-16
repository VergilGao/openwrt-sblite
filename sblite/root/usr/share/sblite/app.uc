'use strict';

import { cursor } from 'uci';
import { CONF_NAME } from './const.uc';
import { log_t, log_tab } from './utils.uc';
import { start as start_crontab, stop as stop_crontab } from './cron.uc';
import { subscribe } from './subscribe.uc';
import { Logical, Headless } from './rule.uc';
import { SingBoxOption } from './singbox.uc';
import * as LOGLEVEL from './loglevel.uc';
import { Outbound } from './outbound.uc';

function start() {
    system('mkdir -p /tmp/sblite');

    const uci = cursor();

    // purne node config
    uci.foreach(CONF_NAME, 'node', section => {
        const group = section.group;
        if (group == null || group == '') {
            uci.set(CONF_NAME, section['.name'], 'hashkey', null);
        }
    });

    uci.commit();

    //const enable = uci.get(CONF_NAME, 'main', 'enable') == '1';
    const enable = true;

    if (enable) {
        start_crontab();
        const outbounds = Outbound(uci);

        const sub_rules = {};
        const rule_sets = {};

        // first get all sub rule set
        uci.foreach(CONF_NAME, 'rule_set', section => {
            if (section.type == 'inline' && section.sub == '1') {
                sub_rules[section.tag] = Headless(section);
            }
        });

        uci.foreach(CONF_NAME, 'rule_set', section => {
            switch (section.type) {
                case 'inline':
                    if (section.sub != '1') {
                        if (section.logical_mode && section.logical_mode != 0) {
                            const rule_set = Logical(section.logical_mode);
                            if (section.sub_rule) {
                                for (let sub_rule_tag in section.sub_rule) {
                                    const sub_rule = sub_rules[sub_rule_tag];
                                    if (sub_rule) {
                                        rule_set.addSubRule(sub_rule);
                                    } else {
                                        log_tab('The sub rule named %s in %s not found', section.sub_rule[i], section.tag);
                                    }
                                }

                                if (!rule_set.is_empty()) {
                                    rule_sets[section.tag] = rule_set;
                                }
                            }
                        } else {
                            rule_sets[section.tag] = Headless(section);
                        }
                    }
                    break;
                case 'local':

                    break;
                case 'remote':
                    break;
            }
        });

        const config = SingBoxOption();
        config.logOption(true, LOGLEVEL.ERROR);
        config.cacheFileOption(true);
        config.clashOption({
            host: '127.0.0.11',
            port: 9090,
            ui: '',
            download_url: 'https://github.com/MetaCubeX/Yacd-meta/archive/gh-pages.zip',
            download_detour: 'direct',
            secret: '',
            default_mode: 'Rule',
        });

        for(let outbound in values(outbounds)) {
            push(config.outbounds, outbound);
        }

        print(config + '\n');
        config.write();
    } else {
        stop_crontab();
    }
}

switch (action) {
    case 'start':
        start();
        break;

    case 'subscribe':
        subscribe(params);
        break;
}

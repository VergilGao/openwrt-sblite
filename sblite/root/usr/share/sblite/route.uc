'use strict';

import { CONF_NAME } from './const.uc';
import { log_tab, delete_empty_arr } from './utils.uc';

export function Route(uci, rule_sets, outbounds) {
    const result = {
        rules: [],
        rule_set: [],
    };

    for (let rule_set in values(rule_sets)) {
        if (rule_set.type == 'inline') { 
            // 先将 1.10 引入的 inline 类型特殊处理一下，因为我路由器上还是 1.8.x
            
        } else {
            push(result.rule_set, rule_set);
        }
    }

    const route_section = uci.get_all(CONF_NAME, 'route');

    if (route_section.custom_default == '1') {
        const final_tag = route_section.final;

        if (final_tag && rule_sets[final_tag]) {
            result.final = final_tag;
        }
    }

    uci.foreach(CONF_NAME, 'route_rule', section => {
        const rule = {
            invert: section.invert == '1',
        };
        const outbound = rule.outbound = section.outbound;

        if (!outbound || !outbounds[outbound]) {
            log_tab('[Route Rule %s] There is no outbound(%s)', section.tag, outbound);
            return;
        }

        if (section.protocol && length(section.protocol) > 0) {
            rule.protocol = [];
            for (let protocol in section.protocol) {
                if (index(['HTTP', 'TLS', 'QUIC', 'STUN', 'BitTorrent'], protocol) > 0) {
                    push(rule.protocol, protocol);
                } else {
                    log_tab('[Route Rule %s] There is no protocol(%s)', section.tag, protocol);
                }
            }

            delete_empty_arr(rule, 'protocol');
        }

        if (section.rule_set && length(section.rule_set) > 0) {
            rule.rule_set = [];
            for (let rule_set in section.rule_set) {
                if (rule_sets[rule_set]) {
                    push(rule.rule_set, rule_set);
                } else {
                    log_tab('[Route Rule %s] There is no rule_set(%s)', section.tag, rule_set);
                }
            }

            delete_empty_arr(rule, 'rule_set');
        }

        push(result.rules, rule);
    });

    return result;
};
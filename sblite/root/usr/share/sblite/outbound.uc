'use strict';

import { log_tab } from './utils.uc';
import { CONF_NAME, REJECT_OUTBOUND_TAG, DNS_OUTBOUND_TAG } from './const.uc';
import { TYPE as vmess_type, outbound as vmess_outbound } from './protocols/vmess.uc';

export function Outbound(uci) {
    const result = {};

    // 先找 Direct
    uci.foreach(CONF_NAME, 'outbound', section => {
        if (section.type == 'direct') {
            if (result[section.tag]) {
                log_tab('Duplicate outbound tag(%s)', section.tag);
            } else {
                result[section.tag] = {
                    type: 'direct',
                    tag: section.tag,
                    bind_interface: section.interface,
                };
            }
        }
    });

    const nodes = {};
    // 再找 Node
    uci.foreach(CONF_NAME, 'node', section => {
        if (section.hashkey) {
            nodes[section.hashkey] = section;
        }
    });

    uci.foreach(CONF_NAME, 'outbound', section => {
        if (section.type == 'node') {
            if (result[section.tag]) {
                log_tab('Duplicate outbound tag(%s)', section.tag);
            } else {
                const node = nodes[section.node];
                const detour = section.outbound;
                if (!result[detour]) {
                    log_tab('There is no direct outbound(%s)', detour);
                    return;
                }

                if (result[detour].type != 'direct') {
                    log_tab('The outbound(%s) is not direct', detour);
                    return;
                }

                if (node) {
                    switch (node.type) {
                        case vmess_type:
                            result[section.tag] = vmess_outbound(node);
                            break;
                        default:
                            log_tab('Unkown protocol(%s) in outbound node(%s)', node.type, section.tag);
                            return;
                    }

                    result[section.tag].tag = section.tag;
                    result[section.tag].detour = detour;
                } else {
                    log_tab('There is no node with hashkey(%s)', section.node);
                }
            }
        }
    });
    
    // 然后找 urltest
    uci.foreach(CONF_NAME, 'outbound', section => {
        if (section.type == 'urltest') {
            if (result[section.tag]) {
                log_tab('Duplicate outbound tag(%s)', section.tag);
            } else {
                result[section.tag] = {
                    type: 'urltest',
                    tag: section.tag,
                    outbounds: [],
                    url: section.url,
                };

                for (let tag in section.include) {
                    const outbound = result[tag];

                    if (!outbound) {
                        log_tab('There is no outbound(%s)', tag);
                        return;
                    } else if (outbound.type == 'urltest') {
                        log_tab('The outbound(%s) is urltest, should not be used in another urltest outbound.', tag);
                        return;
                    }

                    push(result[section.tag].outbounds, tag);
                }
            }
        }
    });

    // 最后添加 BLOCK 出站和 DNS 出站
    result[REJECT_OUTBOUND_TAG] = {
        type: 'block',
        tag: REJECT_OUTBOUND_TAG,
    };

    result[DNS_OUTBOUND_TAG] = {
        type: 'dns',
        tag: DNS_OUTBOUND_TAG,
    };

    return result;
};

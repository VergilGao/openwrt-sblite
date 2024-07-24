'use strict';

import { log_tab, asip, asport } from './utils.uc';
import { CONF_NAME, DNS_BLOCK_TAG, FAKE_IP_TAG } from './const.uc';

export const PREFER_IPV4 = 'prefer_ipv4';
export const PREFER_IPV6 = 'prefer_ipv6';
export const ONLY_IPV4 = 'ipv4_only';
export const ONLY_IPV6 = 'ipv6_only';

export function DNS(uci, rule_sets, outbounds) {
    const result = {
        final: '',
        strategy: '',
        disable_cache: false,
        disable_expire: false,
        independent_cache: false,
        reverse_mapping: false,
    };

    const servers = {};

    uci.foreach(CONF_NAME, 'dns_server', section => {
        let strategy = section.strategy;

        if (strategy != PREFER_IPV4 && strategy != PREFER_IPV6 && strategy != ONLY_IPV4 && strategy != ONLY_IPV6) {
            log_tab('[DNS Server %s] Unkown strategy(%s), fallback to %s', section.tag, strategy, PREFER_IPV4);
            strategy = PREFER_IPV4;
        }

        const server = {
            tag: section.tag,
            address: section.address,
            strategy: strategy,
        };

        if (section.custom_detour == '1') {
            const detour = section.detour;

            if (outbounds[detour]) {
                server.detour = detour;
            } else {
                log_tab('[DNS Server %s] Unkown outbound tag(%s)', detour);
            }
        }

        if (section.resolver == '1') {
            const tag = section.resolver_tag;

            if (outbounds[tag]) {
                server.address_resolver = tag;

                let strategy = section.resolver_strategy;

                if (strategy != PREFER_IPV4 && strategy != PREFER_IPV6 && strategy != ONLY_IPV4 && strategy != ONLY_IPV6) {
                    log_tab('[DNS Server %s] Unkown resolver strategy(%s), fallback to %s', section.tag, strategy, PREFER_IPV4);
                    strategy = PREFER_IPV4;
                }

                server.address_strategy = strategy;
            } else {
                log_tab('[DNS Server %s] Unkown resolver tag(%s)', tag);
            }
        }

        servers[section.tag] = server;
    });

    servers[DNS_BLOCK_TAG] = {
        address: 'rcode://success',
        tag: DNS_BLOCK_TAG,
    };

    let strategy = uci.get(CONF_NAME, 'dns', 'strategy');

    if (strategy != PREFER_IPV4 && strategy != PREFER_IPV6 && strategy != ONLY_IPV4 && strategy != ONLY_IPV6) {
        log_tab('[DNS Setting] Unkown strategy(%s), fallback to %s', strategy, PREFER_IPV4);
        strategy = PREFER_IPV4;
    }

    result.strategy = strategy;

    if (uci.get(CONF_NAME, 'dns', 'custom_default') == 1) {
        const final = uci.get(CONF_NAME, 'dns', 'final');
        if (servers[final]) {
            result.final = final;
        } else {
            log_tab('[DNS Setting] Unkown custom defualt dns tag(%s)', final);
        }
    }

    const rules = [];
    uci.foreach(CONF_NAME, 'dns_rule', section => {
        const server = section.server;

        if (servers[server]) {
            if (section.rule_set && length(section.rule_set) > 0) {
                const current_rule_sets = [];
                for (let rule_set in section.rule_set) {
                    if (rule_sets[rule_set]) {
                        push(current_rule_sets, rule_set);
                    } else {
                        log_tab('[DNS Rule %s] Unkown rule set tag(%s)', rule_set);
                    }
                }

                if (length(current_rule_sets) > 0) {
                    push(rules, {
                        rule_set: current_rule_sets,
                        server: server,
                    });
                }
            }
        } else {
            log_tab('[DNS Rule %s] Unkown dns server tag(%s)', server);
        }
    });

    if (uci.get(CONF_NAME, 'dns', 'fake_ip') == '1') {
        const fake_ip_inet4_range = uci.get(CONF_NAME, 'dns', 'fake_ip_inet4_range');
        const fake_ip_inet6_range = uci.get(CONF_NAME, 'dns', 'fake_ip_inet4_range');
        const v4 = asip(fake_ip_inet4_range);
        const v6 = asip(fake_ip_inet6_range);

        if (v4 && v4.version == 4 && v4.cidr != 32) {

            if (v6 && v6.version == 6 && v6.cidr != 128) {
                servers[FAKE_IP_TAG] = {
                    tag: FAKE_IP_TAG,
                    adress: 'fakeip',
                };

                push(rules, {
                    query_type: ['A', 'AAAA'],
                    server: FAKE_IP_TAG,
                });

                result.fakeip = {
                    enabled: true,
                    inet4_range: `${v4.address}/${v4.cidr}`,
                    inet6_range: `${v6.address}/${v6.cidr}`,
                };
            } else {
                log_tab('[DNS Setting] Invalid fake ip setting(%s)', fake_ip_inet6_range);
            }
        } else {
            log_tab('[DNS Setting] Invalid fake ip setting(%s)', fake_ip_inet4_range);
        }
    }

    result.servers = values(servers);
    result.rules = rules;

    return result;
};

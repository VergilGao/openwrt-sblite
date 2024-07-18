'use strict';

import { log_tab, asip, asport, delete_empty_arr } from './utils.uc';
import { CONF_NAME } from './const.uc';

function config_ip_and_port(section, section_ip, section_port, config, config_ip, config_port, config_port_range) {
    if (section[section_ip]) {
        config[config_ip] = [];

        for (let line in section[section_ip]) {
            const ip = asip(line);
            if (ip) {
                push(config[config_ip], `${ip.address}/${ip.cidr}`);
            } else {
                log_tab('Unkown ip (%s) setting in %s', line, section.tag);
            }
        }

        if (length(config[config_ip]) == 0) {
            delete config[config_ip];
        }
    }

    if (section[section_port]) {
        config[config_port] = [];
        config[config_port_range] = [];

        for (let line in section[section_port]) {
            const port = asport(line);
            if (port) {
                if (port.range) {
                    push(config[config_port_range], `${port.start}:${port.end}`);
                } else {
                    push(config[config_port], `${port.value}`);
                }

            } else {
                log_tab('Unkown port (%s) setting in %s', line, section.tag);
            }
        }

        delete_empty_arr(config, config_port);
        delete_empty_arr(config, config_port_range);
    }
}

function rule(section) {
    const result = { invert: section.invert == '1' };

    switch (section.network) {
        case null:
        case '0': result.network = ['tcp', 'udp']; break;
        case '1': result.network = ['tcp']; break;
        case '2': result.network = ['udp']; break;
        default:
            log_tab('Unkown rule_set network (%s) setting in %s', section.network, section.tag);
            result.network = ['tcp', 'udp']; break;
    }

    config_ip_and_port(section, 'source', 'source_port', result, 'source_ip_cidr', 'source_port', 'source_port_range');
    config_ip_and_port(section, 'dest', 'dest_port', result, 'ip_cidr', 'port', 'port_range');

    if (section.domain) {
        result.domain = [];
        result.domain_suffix = [];
        result.domain_keyword = [];
        result.domain_regex = [];

        const lines = split(section.domain, /[(\r\n)\r\n]+/);

        for (let line in lines) {
            line = trim(line);
            let match_result;
            if (match_result = match(line, /#.*/)) {
                continue;
            } else if (match_result = match(line, /domain: *(.+)/)) {
                push(result.domain, trim(match_result[1]));
            } else if (match_result = match(line, /suffix: *(.+)/)) {
                push(result.domain_suffix, trim(match_result[1]));
            } else if (match_result = match(line, /keyword: *(.+)/)) {
                push(result.domain_keyword, trim(match_result[1]));
            } else if (match_result = match(line, /regex: *(.+)/)) {
                push(result.domain_regex, trim(match_result[1]));
            } else {
                log_tab('Unkown rule_set domain (%s) setting in %s', line, section.tag);
            }
        }

        delete_empty_arr(result, 'domain');
        delete_empty_arr(result, 'domain_suffix');
        delete_empty_arr(result, 'domain_keyword');
        delete_empty_arr(result, 'domain_regex');
    }

    return result;
}

function headless(section, sub_rules) {
    if (section.logical_mode && section.logical_mode != '0') {
        const headless = {
            type: 'logical',
            invert: section.invert == '1',
            rules: []
        };
        if (section.logical_mode == '1') {
            headless.mode = 'and';
        } else if (section.logical_mode == '2') {
            headless.mode = 'or';
        } else {
            log_tab('[Rule Set %s] Unkown rule set logical_mode %s', section.tag, section.logical_mode);
            return;
        }

        if (section.sub_rule) {
            for (let sub_rule_tag in section.sub_rule) {
                const sub_rule = sub_rules[sub_rule_tag];
                if (sub_rule) {
                    push(headless.rules, sub_rule);
                } else {
                    log_tab('[Rule Set %s] Unkown sub rule set tag %s', section.tag, sub_rule_tag);
                }
            }

            if (length(headless.rules) > 0) {
                return headless;
            }
        }
    } else {
        const headless = rule(section);
        return headless;
    }
}

function rule_set(section, headless_rules, sub_rules, outbounds) {
    switch (section.type) {
        case 'headless':
            return;
        case 'inline':
            const inline = {
                type: section.type,
                tag: section.tag,
                rules: [],
            };

            if (section.advance != '1') {
                const rule = headless(section, sub_rules);
                push(inline.rules, rule);
            } else {
                for (let tag in section.headless) {
                    const rule = headless_rules[tag];
                    if (rule) {
                        push(inline.rules, rule);
                    } else {
                        log_tab('[Rule Set %s] Unkown headless rule set tag %s', section.tag, tag);
                    }
                }
            }

            if (length(inline.rules) > 0) {
                return inline;
            }
            return;
        case 'local':
            const local = {
                type: section.type,
                tag: section.tag,
            };
            if (section.format == 'binary' || section.format == 'source') {
                local.format = section.format;
            } else {
                log_tab('[Rule Set %s] Unkown rule set format %s', section.tag, section.format);
                return;
            }

            if (section.path) {
                local.path = section.path;
            } else {
                log_tab('[Rule Set %s] Local rule set path undefined', section.tag);
                return;
            }

            return local;
        case 'remote':
            const remote = {
                type: section.type,
                tag: section.tag,
            };

            if (section.format == 'binary' || section.format == 'source') {
                remote.format = section.format;
            } else {
                log_tab('[Rule Set %s] Unkown rule set format %s', section.tag, section.format);
                return;
            }

            if (section.url) {
                remote.url = section.url;
            } else {
                log_tab('[Rule Set %s] Remote rule set url undefined', section.tag);
                return;
            }

            if (section.default_detour == '0' && section.download_detour) {
                if (outbounds[section.download_detour]) {
                    remote.download_detour = section.download_detour;
                } else {
                    log_tab('[Rule Set %s] There is no outbound(%s)', section.tag, section.download_detour);
                    return;
                }
            }

            return remote;
        default:
            log_tab('[Rule Set %s] Unkown rule set type %s', section.tag, section.type);
            return;
    }
}

export function RuleSet(uci, outbounds) {
    const sub_rules = {}, headless_rules = {}, rule_sets = {};

    uci.foreach(CONF_NAME, 'rule_set', section => {
        if (section.type == 'headless' && section.sub == '1') {
            sub_rules[section.tag] = rule(section);
        }
    });

    uci.foreach(CONF_NAME, 'rule_set', section => {
        if (section.type == 'headless' && section.sub != '1') {
            headless_rules[section.tag] = headless(section, sub_rules);
        }
    });

    uci.foreach(CONF_NAME, 'rule_set', section => {
        if (section.type == 'headless') {
            return;
        }

        const ruleSet = rule_set(section, headless_rules, sub_rules, outbounds);
        if (ruleSet) {
            rule_sets[section.tag] = ruleSet;
        }
    });

    return rule_sets;
};

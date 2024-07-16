'use strict';

import { log_tab, asip, asport } from './utils.uc';

function delete_empty_arr(obj, arr_name) {
    if (length(obj[arr_name]) == 0) {
        delete obj[arr_name];
    }
}

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

export function Headless(section) {
    const result = {};

    if (section.invert == '1') {
        result.invert = true;
    }

    switch (section.network) {
        case null:
        case '0': result.network = ['tcp', 'udp']; break;
        case '1': result.network = ['tcp']; break;
        case '2': result.network = ['udp']; break;
        default:
            log_tab('Unkown rule_set network (%s) setting in %s', section.network, section.tag);
            result.network = ['tcp', 'udp']; break;
    }

    if (section.protocol) {
        const protocols = [];

        for (let i = 0; i < length(section.protocol); i++) {
            const protocol = section.protocol[i];
            if (index(['HTTP', 'TLS', 'QUIC', 'STUN', 'BitTorrent'], protocol) > 0) {
                push(protocols, protocol);
            } else {
                log_tab('Unkown rule_set protocol (%s) setting in %s', protocol, section.tag);
            }
        }

        if (length(protocols) > 0) {
            result.protocol = protocols;
        }
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
};

export function Logical(value) {
    let mode;

    switch (value) {
        case '1': mode = 'and'; break;
        case '2': mode = 'or'; break;
        default:
            die(`unkown rule logical mode ${mode}`);
    }

    return proto({
        type: 'logical',
        mode: mode,
        rules: [],
        invert: false,
    }, {
        addSubRule: function (rule) {
            push(this.rules, rule);
        },

        is_empty: function () {
            return !(length(this.rules) > 0);
        }
    });
};

export function RuleSet() {

};

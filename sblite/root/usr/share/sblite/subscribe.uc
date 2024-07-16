'use strict';

import { cursor } from 'uci';
import { PKG_NAME, CONF_NAME } from './const.uc';
import { wget, log_t, log_tab } from './utils.uc';
import { parse as vmess_parse } from './protocols/vmess.uc';

function filter(name, mode) {
    switch (mode.mode) {
        case '1': // 按关键字丢弃
            return !match(name, mode.excludes);
        case '2': // 按关键字保留
            return match(name, mode.includes);
        case '3': // 按关键字丢弃未匹配成功保留列表的项
            return match(name, mode.includes) || !match(name, mode.excludes);
        case '4': // 按关键字保留未匹配成功丢弃列表的项
            return !match(name, mode.excludes) && match(name, mode.includes);
        default:
        case '0': // 不过滤
            return true;
    }
}

function get_filter_mode(mode, includes, excludes) {
    const result = {
        mode: mode,
    };

    if (result.mode && result.mode != '0') {
        if (result.mode == '1' ||
            result.mode == '3' ||
            result.mode == '4' &&
            excludes &&
            length(excludes) > 0) {
            excludes = map(excludes, str => replace(str, /[\\.*+?^$|\[(){}]/g, '\\$&'));
            result.excludes = regexp(join('|', excludes));
        }

        if (result.mode == '2' ||
            result.mode == '3' ||
            result.mode == '4' &&
            includes &&
            length(includes) > 0) {
            includes = map(includes, str => replace(str, /[\\.*+?^$|\[(){}]/g, '\\$&'));
            result.includes = regexp(join('|', includes));
        }

        if (result.mode >= '5') {
            result.mode = '0';
        }
    }

    if (result.mode == '3' && !result.includes) {
        result.mode = '1';
    }

    if (result.mode == '4' && !result.excludes) {
        result.mode = '2';
    }

    if (result.mode == '1' && !result.excludes) {
        result.mode = '0';
    }

    if (result.mode == '2' && !result.includes) {
        result.mode = '0';
    }

    return result;
}

function subscribe_one(section, filter_mode, results) {
    if (!results) {
        results = {};
    }

    const group = section.tag;
    const url = section.subscribe_url;
    const no_certificate = section.no_certificate;
    const ua = section.ua;

    log_t('[%s] start...', group);
    log_tab('Filter mode %J', filter_mode);

    const handle = wget(url, no_certificate, ua);

    if (handle) {
        let content = handle.read('all');

        const decode = b64dec(content);

        if (decode != null) {
            content = decode;
        }

        if (content) {
            const lines = split(content, /[\r\n]/g);

            for (let line in lines) {
                line = trim(line);

                if (line != '') {
                    let result = {
                        group: group,
                    };

                    if (vmess_parse(line, result)) {
                        // 
                    } else {
                        continue;
                    }

                    if (filter(result.alias, filter_mode)) {
                        log_tab('Get %s Hash: %s', result.alias, result.hashkey);
                        results[result.hashkey] = result;
                    } else {
                        log_tab('Discard %s', result.alias);
                    }
                }
            }
        }

        log_t('[%s] done.', group);
        handle.close();
    }
    else {
        log_t('[%s] error.', group);
    }

    return results;
}

export function subscribe(section_id) {
    const uci = cursor();
    let results = {};

    const subscribe_section = uci.get_all(CONF_NAME, 'subscribe');


    const filter_mode = get_filter_mode(
        subscribe_section.filter_mode,
        subscribe_section.whitelist,
        subscribe_section.blacklist
    );

    log_tab('Global filter mode %J', filter_mode);

    if (section_id) {
        const section = uci.get_all(CONF_NAME, section_id);
        if (section) {
            section_id = section.tag;

            if (section.filter_mode == '5') {
                results = subscribe_one(section, filter_mode);
            } else {
                results = subscribe_one(section, get_filter_mode(
                    section.filter_mode,
                    section.whitelist,
                    section.blacklist
                ));
            }
        } else {
            log_t('can\'t get subscribe config %s...', section_id);
        }

    } else {
        log_t('subscribe starting...');
        uci.foreach(CONF_NAME, 'subscription',
            function (section) {
                if (section.filter_mode == '5') {
                    results = subscribe_one(section, filter_mode, results);
                } else {
                    results = subscribe_one(section, get_filter_mode(
                        section.filter_mode,
                        section.whitelist,
                        section.blacklist
                    ), results);
                }
            }
        );
        log_t('All done.');
    }

    uci.foreach(CONF_NAME, 'node', section => {
        const group = section.group;
        if (group != null && group != '') {
            if (section_id && group != section_id) {
                return;
            }

            uci.delete(CONF_NAME, section['.name']);
        }
    });

    for (let hashkey in keys(results)) {
        const result = results[hashkey];
        const sid = uci.add(CONF_NAME, 'node');
        for (let option in keys(result)) {
            uci.set(CONF_NAME, sid, option, result[option]);
        }
    }

    print(results);

    if (uci.commit(CONF_NAME)) {
        return results;
    }
    else {
        die('commit failed!');
    }
};

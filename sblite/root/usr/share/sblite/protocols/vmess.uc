'use strict';

import { md5, log_t } from '../utils.uc';

// see: https://github.com/jarryson/singbox-subscribe/blob/main/parsers/vmess.py

export const TYPE = 'vmess';

export function parse(content, result) {
    const matches = match(content, /vmess:\/\/(.*)/);

    if (matches) {
        let payload = matches[1];

        const decode = b64dec(payload);

        if (decode != null) {
            payload = decode;
        }

        if (payload) {
            const info = json(payload);

            if (info) {
                result.type = TYPE;
                result.server = info['add'];
                result.server_port = int(info['port']);
                result.uuid = info['id'];
                result.alter_id = info['aid'] ?? '0';
                result.security = info['scy'] ?? 'auto';
                if(result.security != 'http') {
                    result.security = 'auto';
                }

                result.alias = sprintf('[%s] %s', result.group, info['ps']);
                result.hashkey = md5(b64enc(sprintf('[%s] %s://%s:%s?id=%s',
                    result.group,
                    result.type,
                    result.server,
                    result.server_port,
                    result.uuid)));
                
                return true;
            }
        }
    }

    return false;
};

export function outbound(section) {
    return {
        type: TYPE,
        tag: section.tag,
        server: section.server,
        server_port: int(section.server_port),
        uuid: section.uuid,
        security: section.security,
        alter_id: int(section.alter_id),
        packet_encoding: 'xudp',
    };
};

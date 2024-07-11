'use strict';
import { md5 } from '../utils.uc';

const vmess = 'vmess';

export const TYPE = vmess;

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
                result.type = vmess;
                result.address = info['add'];
                result.port = info['port'];
                result.transport = info['net'];
                result.alter_id = info['aid'];
                result.id = info['id'];
                result.alias = info['ps'];
                result.hashkey = md5(b64enc(result['group'] + ' ' + result['type'] + '://' + result['address'] + ':' + result['port'] + '|' + result['transport'] + ' ' + result['alter_id'] + ' ' + result['id']));

                return true;
            }
        }
    }

    return false;
};

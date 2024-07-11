'use strict';

import { log_t } from './utils.uc';
import * as app from './export.uc';

switch(action) {
    case 'start':
        system('mkdir -p /tmp/sblite');
        break;

    case 'log':
        log_t(params);
        break;
}

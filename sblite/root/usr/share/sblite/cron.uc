'use strict';

import { cursor } from 'uci';
import { APP_FILE, CONF_NAME } from './const.uc';

function clean() {
    system('touch /etc/crontabs/root');
    system('sed -i "/ucode -D action=subscribe -D params=.*sblite/d" /etc/crontabs/root');
}

export function start() {
    clean();

    const uci = cursor();

    uci.foreach(CONF_NAME, 'subscription',
        function (section) {
            if (section.auto_subscribe == '1') {
                let day = section.auto_subscribe_daily;
                let week = section.auto_subscribe_weekly;
                if(week == '0') {
                    week = '*';
                }

                const command = sprintf('echo "0 %s * * %s ucode -D action=subscribe -D params=%s %s > /dev/null 2>&1 &" >> /etc/crontabs/root', day, week, section['.name'], APP_FILE);
                system(command);
            }
        }
    );

    system('/etc/init.d/cron restart');
};

export function stop() {
    clean();
    system('/etc/init.d/cron restart');
};

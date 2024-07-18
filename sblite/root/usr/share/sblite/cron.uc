'use strict';

import { cursor } from 'uci';
import { APP_FILE, CONF_NAME } from './const.uc';

function clean() {
    system('touch /etc/crontabs/root');
    system(`sed -i "#sh ${APP_FILE} subscribe cfg.* > /dev/null 2>&1 &#d" /etc/crontabs/root`);
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

                const command =`echo "0 ${day} * * ${week} sh ${APP_FILE} subscribe ${section['.name']} > /dev/null 2>&1 &" >> /etc/crontabs/root`;
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

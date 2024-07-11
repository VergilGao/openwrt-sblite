'use strict';
'require dom';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require network';
'require view';

const config_name = 'sblite';
const ENABLE_CONFIG_NAME = 'enable';

const callSubscribe = rpc.declare({
    object: 'luci.sblite',
    method: 'subscribe',
    expect: { '': {} }
});

const callClearlog = rpc.declare({
    object: 'luci.sblite',
    method: 'clear_log',
});

const modalStyle = '  height:50%; width:50%;  position:absolute; top:20%; left:25%; background-color:#800080; border-radius: 15px;';

return view.extend({
    load: function () {
        return Promise.all(
            [
                async function () {
                    await uci.load(config_name);
                    return;
                    const div = document.getElementById('maincontent');

                    const content = E('div',);

                    const modal = E('div', {
                        id: 'sblite-modal'
                    }, content);

                    let style = div.style;
                    style.display = 'none';
                    style.padding = '20px';
                    style.zIndex = '1';
                    style.position = 'fixed';
                    style.left = '0';
                    style.top = '0';
                    style.width = '100%';
                    style.height = '100%';
                    style.overflow = 'auto';
                    style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

                    div.appendChild(modal);
                }(),

                async function () {
                    const data = await Promise.all(
                        [
                            network.getNetworks(),
                            network.getWANNetworks(),
                        ]
                    );

                    let lanInterfaces = data[0];
                    let wanInterfaceNames = [];
                    let wanInterfaces = [];

                    data[1].forEach(element => {
                        wanInterfaceNames.push(element.getIfname());
                        wanInterfaces.push(element);
                    });

                    lanInterfaces = lanInterfaces.filter(element => !wanInterfaceNames.includes(element.getIfname()));

                    return {
                        wanInterfaces: wanInterfaces,
                        lanInterfaces: lanInterfaces,
                    };
                }(),
            ]
        );
    },

    render: function (data) {
        const map = new form.Map(config_name);

        let wanInterfaces = data[1].wanInterfaces;
        let lanInterfaces = data[1].lanInterfaces;

        let s, o;

        s = map.section(form.NamedSection, 'main', 'sing_box', _('sing-box lite'), '');
        s.addremove = false;

        const tabName = 'main';

        s.tab(tabName, _('Main Settings'));

        o = s.taboption(tabName, form.Flag, ENABLE_CONFIG_NAME, _('Enable Server'));
        o.rmempty = false;
        o.default = false;

        render_dns_tab(map, s);
        render_outbound_tab(map, s, wanInterfaces, lanInterfaces);
        render_nodes_tab(map, s);
        render_subscription_tab(map, s);
        render_custom_rule_tab(map, s);
        render_log_tab(map, s);

        return map.render();
    },
});

function render_dns_tab(map, parent) {
    const tabName = 'dns';
    let s, o;

    parent.tab(tabName, _('DNS Settings'));

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'dns',
        form.NamedSection,
        'dns',
        'sing_box',
        '')
        .subsection;

    o = s.option(form.Value, 'listen_port', _('Listen Port'), _('The port number on which the DNS service runs'));
    o.datatype = 'port';
    o.default = 7535;

    o = s.option(form.Flag, 'fake_ip', _('Use Fake IP'));
    o.rmempty = false;
    o.default = true;

    o = s.option(form.Value, 'fake_ip_inet4_range', _('Fake IP IPv4 Address Range'));
    o.rmempty = false;
    o.depends('fake_ip', '1');
    o.datatype = 'ip4addr';
    o.default = '198.18.0.0/15';

    o = s.option(form.Value, 'fake_ip_inet6_range', _('Fake IP IPv6 Address Range'));
    o.rmempty = false;
    o.depends('fake_ip', '1');
    o.datatype = 'ip6addr';
    o.default = 'fc00::/18';

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'servers',
        form.GridSection,
        'dns_server',
        '')
        .subsection;
    s.addremove = true;
    s.anonymous = true;
}

function render_outbound_tab(map, parent, wanInterfaces, lanInterfaces) {
    const tabName = 'outbound';
    let s, o;

    parent.tab(tabName, _('Outbounds Settings'));

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'wan_list',
        form.GridSection,
        'wan',
        _('WAN List'),
        _('Direct outbound interfaces.'))
        .subsection;
    s.addremove = true;
    s.anonymous = true;

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'name');
        return _('WAN Configuration') + ' » ' + (name ?? _('unamed interface'));
    };

    o = s.option(form.Value, 'tag', _('Outbound Tag'));
    o.rmempty = false;
    o.datatype = 'string';

    o = s.option(form.ListValue, 'interface', _('Interface'));
    o.rmempty = false;
    wanInterfaces.forEach(element => {
        let ifname = element.getIfname();
        o.value(ifname, `${element.sid} (${ifname})`);
    });
}

function render_nodes_tab(map, parent) {
    const tabName = 'nodes';
    let s, o;

    parent.tab(tabName, _('Node List'));

    o = parent.taboption(tabName, form.DummyValue, '_nodes_info', '');
    o.cfgvalue = function (section_id) {
        const outbounds = uci.sections(config_name, 'node');

        if (outbounds && Array.isArray(outbounds)) {
            const groups = outbounds.reduce((groups, outbound) => {
                const key = outbound.group;
                if (key) {
                    if (!groups[key]) {
                        groups[key] = 0;
                    }

                    groups[key]++;
                }

                return groups;
            }, {});

            const count = Object.values(groups).reduce((count, group) => count += group, 0);
            let text = `${_('Manual Add')}: ${outbounds.length - count}`;
            for (let key in groups) {
                text += ` ${key}: ${groups[key]}`;
            }

            return text;

        } else {
            return _('Node List is Empty');
        }
    };
    o.write = function () { };

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'nodes',
        form.GridSection,
        'node',
        '')
        .subsection;
    s.addremove = true;
    s.anonymous = true;
    s.sortable = true;

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'alias');

    s.renderRowActions = function (section_id) {
        let tdEl = this.super('renderRowActions', [section_id, _('Edit')]);

        const group = uci.get(config_name, section_id, 'group');

        if (group !== undefined && group !== null && group !== '') {
            dom.content(tdEl.lastChild, [
                E('button', {
                    class: 'btn cbi-button-negative',
                    click: ui.createHandlerFn(this, function (section_id) {
                        uci.unset(config_name, section_id, 'group');
                        uci.unset(config_name, section_id, 'hashkey');
                        return map.save(null, true);
                    }, section_id),
                    title: _('Unbind this node from the subscription'),
                }, _('Unbind')),
            ]);
        }
        else { }

        return tdEl;
    };

    o = s.option(form.DummyValue, '_group', _('Subscription Group'));
    o.modalonly = false;
    o.textvalue = function (section_id) {
        const group_id = uci.get(config_name, section_id, 'group');

        if (group_id) {
            const group_name = uci.get(config_name, group_id, 'remark');

            return group_name;
        } else {
            return '';
        }
    };
}

function render_subscription_tab(map, parent) {
    const tabName = 'subscription';
    let s, o;

    parent.tab(tabName, _('Node Subscribe'));

    s = parent.taboption(
        tabName,
        form.SectionValue,
        '_subscribe',
        form.NamedSection,
        'subscribe',
        'sing_box',
        '').subsection;
    s.addremove = false;
    s.anonymous = true;

    const set_filter_mode = function (s, global) {
        o = s.option(form.ListValue, 'filter_mode', _('Keyword Filter'));
        o.value(0, _('Close'));
        o.value(1, _('Discard List'));
        o.value(2, _('Keep List'));
        o.value(3, _('Discard List, But Keep List First'));
        o.value(4, _('Keep List, But Discard List First'));

        if (global) {
            o.value(5, _('Global'));
        }

        o = s.option(form.DynamicList, 'blacklist', _('Discard List'));
        o.rmempty = false;
        o.datatype = 'list(string)';
        o.depends('filter_mode', '1');
        o.depends('filter_mode', '3');
        o.depends('filter_mode', '4');

        o = s.option(form.DynamicList, 'whitelist', _('Keep List'));
        o.rmempty = false;
        o.datatype = 'list(string)';
        o.depends('filter_mode', '2');
        o.depends('filter_mode', '3');
        o.depends('filter_mode', '4');
    };

    set_filter_mode(s, false);

    o = s.option(form.DummyValue, '_manual_subscribe_button', _('Manual Subscribe'));
    o.modalonly = false;
    o.cfgvalue = function (section_id) {
        return E('button', {
            class: 'btn cbi-button-positive',
            click: ui.createHandlerFn(this, function () {
                const modal = document.getElementById('sblite-modal');
                modal.style.display = 'flex';
            }),
            title: _('Manual Subscribe'),
        }, _('Manual Subscribe'));
    };
    o.write = function () { };

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'subscribe_list',
        form.GridSection,
        'subscription',
        '')
        .subsection;
    s.addremove = true;
    s.description = E('div', { style: 'color:red' }, _('Please input the subscription url first, save and submit before manual subscription.'))

    s.modaltitle = function (section_id) {
        return _('subscription Configuration') + ' » ' + section_id;
    };

    s.addModalOptions = function (s, section_id) {
        o = s.option(form.Value, 'remark', _('Subscription Name'));
        o.rmempty = false;
        o.datatype = 'string';

        o = s.option(form.Value, 'subscribe_url', _('Subscription Url'));
        o.rmempty = false;
        o.datatype = 'string';

        o = s.option(form.Flag, 'no_certificate', _('Allow Insecure Connections'), _('Whether or not to allow insecure connections. When checked, certificate verification is skipped.'));
        o.rmempty = false;

        set_filter_mode(s, true);

        o = s.option(form.Flag, 'auto_subscribe', _('Auto Update Subscription'));
        o.rmempty = false;

        o = s.option(form.ListValue, 'auto_subscribe_weekly', _('Week update rules'));
        o.rmempty = false;
        o.depends('auto_subscribe', '1');
        o.value(0, _('Every Day'));
        o.value(1, _('Monday'));
        o.value(2, _('Tuesday'));
        o.value(3, _('Wednesday'));
        o.value(4, _('Thursday'));
        o.value(5, _('Friday'));
        o.value(6, _('Saturday'));
        o.value(7, _('Sunday'));

        o = s.option(form.ListValue, 'auto_subscribe_daily', _('Day update rules'));
        o.depends('auto_subscribe', '1');
        for (let i = 0; i < 24; i++) {
            o.value(i.toString(), `${i}:00`);
        }

        o = s.option(form.Value, 'ua', _('User-Agent'));
        o.datatype = 'string';
        o.value('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
        o.value('sblite/OpenWrt');
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'remark');

    o = s.option(form.DummyValue, '_subscribe_count', _('Count'));
    o.modalonly = false;
    o.textvalue = function (section_id) {
        const outbounds = uci.sections(config_name, 'node');

        if (outbounds && Array.isArray(outbounds)) {
            return outbounds.filter(section => section.group === section_id).length;
        } else {
            return 0;
        }
    };

    o = s.option(form.Value, 'subscribe_url', _('Subscription Url'));
    o.editable = true;
    o.modalonly = false;

    o = s.option(form.DummyValue, 'auto_subscribe', _('Auto Update'));
    o.modalonly = false;
    o.textvalue = function (section_id) {
        return uci.get(config_name, section_id, 'auto_subscribe') === '1' ? _('Yes') : _('No');
    };

    o = s.option(form.DummyValue, '_remove_this_subscriptions_button');
    o.modalonly = false;
    o.textvalue = function (section_id) {
        return E('button', {
            class: 'btn cbi-button-negative',
            click: ui.createHandlerFn(this, function (section_id) {
                const outbounds = uci.sections(config_name, 'node');
                outbounds.forEach(section => {
                    if (section.group === section_id) {
                        map.data.remove(config_name, section['.name']);
                    }
                });

                return map.save(null, true);
            }, section_id),
            title: _('Delete Subscribe Nodes'),
        }, _('Delete Subscribe Nodes'));
    };

    o = s.option(form.DummyValue, '_manual_subscribe_button');
    o.modalonly = false;
    o.textvalue = function (section_id) {
        return E('button', {
            class: 'btn cbi-button-positive',
            click: ui.createHandlerFn(this, async function () {
                try {
                    const res = await callSubscribe();
                    uci.unload(config_name);
                    await uci.load(config_name);
                    const arr = Object.keys(res).map(key => `${res[key].alias} [${res[key].address}:${res[key].port}]`);
                    if (arr.length > 0) {
                        alert(_('订阅到的节点列表') + '\n' + arr.join('\n'));
                    }
                    else {
                        //alert(_('未获取到任何节点'));
                    }
                }
                catch (err) {
                    alert(_('更新订阅出现异常' + '\n' + err));
                }

                //await map.load();

                return map.save(null, true);
            }),
            title: _('Manual Subscribe'),
        }, _('Manual Subscribe'));
    };
}

function render_custom_rule_tab(map, parent) {
    const tabName = 'custom_rules';
    let s, o;

    parent.tab(tabName, _('Custom Rules'));

    const logical_mode_selections = {
        '0': _('Close'),
        '1': _('And Mode'),
        '2': _('Or Mode'),
    };

    const network_selections = {
        '0': _('TCP and UDP'),
        '1': _('TCP'),
        '2': _('UDP'),
    };

    const protocol_selections = {
        'HTTP': _('QUIC'),
        'TLS': _('TLS'),
        'QUIC': _('QUIC'),
        'STUN': _('STUN'),
        'BitTorrent': _('BitTorrent'),
    };

    function addModalOptions(s, section_id, sub) {
        if (!sub) {
            o = s.option(form.Flag, ENABLE_CONFIG_NAME, _('Enable'), _('Enable this route rule.'));
            o.rmempty = false;
            o.default = true;
        }

        o = s.option(form.Flag, 'invert', _('Invert'), _('Invert match result.'));
        o.rmempty = false;

        if (!sub) {
            o = s.option(form.ListValue, 'outbound', _('Outbound'));
            o.rmempty = false;
            o.description = `${_('Tag of the Target Outbound')}<br />
                - ${_('Disable')}: ${_('This rule will not take effect')}<br />
                - ${_('Block')}: ${_('block outbound closes all incoming requests')}`;

            o.value('disable', _('Disable'));
            uci.sections(config_name, 'wan').forEach(element => {
                o.value(element.tag);
            });
            o.value('block', _('Block'));

            let sub_rules = [];

            uci.sections(config_name, 'sub_rules').forEach(element => {
                if (element.sub === '1' && element['.name'] !== section_id)
                    sub_rules.push(element['.name']);
            });

            if (sub_rules.length > 1) {
                o = s.option(form.ListValue, 'logical_mode', _('Logical Mode'));
                Object.keys(logical_mode_selections).forEach(key => o.value(key, logical_mode_selections[key]));

                o = s.option(form.MultiValue, 'sub_rule', _('Sub rules'));
                o.depends('logical_mode', '1');
                o.depends('logical_mode', '2');
                o.modalonly = true;
                sub_rules.forEach(element => o.value(element));
            } else {
                uci.set(config_name, section_id, 'logical_mode', 0);
            }
        }

        o = s.option(form.ListValue, 'network', _('Network'));
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        Object.keys(network_selections).forEach(key => o.value(key, network_selections[key]));

        o = s.option(form.MultiValue, 'protocol', _('Protocol'));
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        Object.keys(protocol_selections).forEach(key => o.value(key, protocol_selections[key]));

        o = s.option(form.DynamicList, 'source', _('Source IP'), `${_('Example')}:<br />- ${_('IP')}: 192.168.1.100<br />- ${_('IP CIDR')}: 192.168.1.0/24`);
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        o.datatype = 'ipaddr';
        o = s.option(form.DynamicList, 'source_port', _('Source Port'), `${_('Example')}:<br />- ${_('Port')}: 80<br />- ${_('Range')}: 1000-2000`);
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        o.datatype = 'portrange';

        o = s.option(form.DynamicList, 'dest', _('Dest IP'), `${_('Example')}:<br />- ${_('IP')}: 192.168.1.100<br />- ${_('IP CIDR')}: 192.168.1.0/24`);
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        o.datatype = 'ipaddr';
        o = s.option(form.DynamicList, 'dest_port', _('Dest Port'), `${_('Example')}:<br />- ${_('Port')}: 80<br />- ${_('Range')}: 1000-2000`);
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        o.datatype = 'portrange';

        o = s.option(form.TextValue, 'domain', _('Domain List'));
        o.depends('logical_mode', '0');
        o.depends('logical_mode', undefined);
        o.description = `${_('Each line is parsed as a rule')}:<br />
            - ${_('Start with #')}: ${_('Comments')}<br />
            - ${_('Start with domain')}: ${_('Match full domain')}<br />
            - ${_('Start with suffix')}: ${_('Match domain suffix')}<br />
            - ${_('Start with keyword')}: ${_('Match domain using keyword')}<br />
            - ${_('Start with regex')}: ${_('Match domain using regular expression')}`;

        o.rows = 10;
        o.wrap = true;
        o.validate = function (section_id, value) {
            const lines = value.split(/[(\r\n)\r\n]+/);

            for (let line of lines) {
                line = line.trim();

                if (!line) {
                    continue;
                }

                if (line.startsWith('#') ||
                    line.startsWith('domain:') ||
                    line.startsWith('suffix:') ||
                    line.startsWith('keyword:') ||
                    line.startsWith('regex:')) {
                    continue;
                }

                return `${_('Parse Error')}: ${line}`;
            }

            return true;
        };
    }

    function ruleDescription(section_id) {
        const description = [];

        const logical_mode = uci.get(config_name, section_id, 'logical_mode');

        if (logical_mode && logical_mode !== '0') {
            description.push(
                E('br'),
                E('b', `${_('Logical Mode')}: `),
                logical_mode_selections[logical_mode],
            );

            description.push(
                E('br'),
                E('b', `${_('Sub rules')}: `),
                uci.get(config_name, section_id, 'sub_rule').join(', '),
            );
        } else {
            const network = uci.get(config_name, section_id, 'network') ?? '0';
            const protocols = uci.get(config_name, section_id, 'protocol');

            description.push(
                E('br'),
                E('b', `${_('Network')}: `),
                network_selections[network],
            );

            if (protocols) {
                description.push(
                    E('br'),
                    E('b', `${_('Protocol')}: `),
                    protocols.join(', '),
                );
            }
        }

        description.push(
            E('br'),
            E('b', `${_('Invert')}: `),
            `${uci.get(config_name, section_id, 'invert') === '1' ? _('Yes') : _('No')}`,
        );

        return E('div', description);
    }

    o = parent.taboption(tabName, form.DummyValue, '_description_text', '');
    o.cfgvalue = function (section_id) {
        return E('div', `${_('The default rule uses the following matching logic:')}
        ${_('Network')} && ${_('Protocol')} && ${_('Source IP')} && ${_('Source Port')} &&
        ${_('Dest IP')} && ${_('Dest Port')} && ${_('Domain List')}`);
    };
    o.write = function () { };

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'custom_rules',
        form.GridSection,
        'custom_rules',
        _('Custom Rules'))
        .subsection;
    s.addremove = true;
    s.sortable = true;
    s.description = E('div', { style: 'color:red' }, _('Please note attention to the priority, the higher the order, the higher the priority.'));

    s.modaltitle = section_id => `${_('Rule Configuration')} » ${section_id}`;

    s.addModalOptions = function (s, section_id) {
        return addModalOptions(s, section_id, false);
    };
    o = s.option(form.DummyValue, '_rule_view');
    o.modalonly = false;
    o.textvalue = ruleDescription;

    s.renderRowActions = function (section_id) {
        let tdEl = this.super('renderRowActions', [section_id, _('Edit')]);

        const enabled = uci.get(config_name, section_id, ENABLE_CONFIG_NAME) === '1';
        dom.content(tdEl.lastChild, [
            tdEl.lastChild.childNodes[0],
            E('button', {
                class: enabled ? 'btn cbi-button-positive' : 'btn cbi-button-negative',
                click: ui.createHandlerFn(this, function (section_id, enabled) {
                    uci.set(config_name, section_id, ENABLE_CONFIG_NAME, enabled ? '1' : '0');
                    map.save(null, true);
                }, section_id, !enabled),
                title: !enabled ? _('Enable') : _('Disable'),
            }, enabled ? _('Enabled') : _('Disabled')),
            tdEl.lastChild.childNodes[1],
            tdEl.lastChild.childNodes[2],
        ]);

        return tdEl;
    };

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'sub_rules',
        form.GridSection,
        'sub_rules',
        _('Sub Rules'),
        _(''))
        .subsection;
    s.addremove = true;
    s.sortable = false;

    s.modaltitle = (section_id) => `${_('Sub Rule Configuration')} » ${section_id}`;

    s.addModalOptions = function (s, section_id) {
        return addModalOptions(s, section_id, true);
    };

    o = s.option(form.DummyValue, '_rule_view');
    o.modalonly = false;
    o.textvalue = ruleDescription;
}

function render_log_tab(map, parent) {
    const tabName = 'log';
    let s, o;

    parent.tab(tabName, _('Log'));

    //o = parent.taboption(tabName, form.ButtonValue, 'clear_log', _('Clear Log'));
    //o.onclick = async () => await callClearlog();

    o = parent.taboption(tabName, form.TextValue, 'log_content', '');
    o.monospace = true;
    o.rows = 25;
    o.cfgvalue = function (section_id) {
        return fs.trimmed('/tmp/log/sblite.log');
    };

    o.write = {};
}
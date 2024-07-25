'use strict';
'require dom';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require network';
'require view';
'require validation';

const config_name = 'sblite';
const ENABLE_CONFIG_NAME = 'enable';
const REJECT_OUTBOUND_TAG = 'reject';
const DNS_OUTBOUND_TAG = 'dns-out';
const DNS_FAKE_IP_TAG = 'fakeip';
const DNS_BLOCK_TAG = 'block';

const callSubscribe = rpc.declare({
    object: 'luci.sblite',
    method: 'subscribe',
    params: ['section_id'],
    expect: { '': {} }
});

const modalStyle = '  height:50%; width:50%;  position:absolute; top:20%; left:25%; background-color:#800080; border-radius: 15px;';

function unique_tag(section_type, section_id, value) {
    let sections = uci.sections(config_name, section_type);
    for (let s of sections) {
        if (s['.name'] != section_id && s.tag === value) {
            return _('Tag conflicts with other sections');
        }
    }

    return true;
}

return view.extend({
    load: function () {
        return Promise.all(
            [
                async function () {
                    await uci.load(config_name);
                    return;
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

        o = s.taboption(tabName, form.Flag, 'log', _('Enable Logger'));
        o.rmempty = false;
        o.default = true;

        o = s.taboption(tabName, form.ListValue, 'loglevel', _('Log Level'));
        o.depends('log', '1');
        o.rmempty = false;
        o.value('trace', _('Trace'));
        o.value('debug', _('Debug'));
        o.value('info', _('Info'));
        o.value('warn', _('Warn'));
        o.value('error', _('Error'));
        o.value('fatal', _('Fatal'));
        o.value('panic', _('Panic'));
        o.default = 'error';

        render_rules(s.taboption(
            tabName,
            form.SectionValue,
            'route_rule',
            form.NamedSection,
            'route',
            'sing_box',
            _('Route Settings')
        ).subsection);

        render_access_control_tab(s);
        render_dns_tab(s);
        render_outbound_tab(s, wanInterfaces, lanInterfaces);
        render_nodes_tab(s);
        render_subscription_tab(s);
        render_rule_set_tab(s);

        return map.render();
    },
});

function render_rules(parent) {
    let s, o;

    o = parent.option(form.Flag, 'custom_default', _('Custom Default Outbound'), _('The first outbound will be used if not set.'));
    o = parent.option(form.ListValue, 'final', _('Default Outbound'), _('Default outbound tag.'));
    o.depends('custom_default', '1');
    o.value(REJECT_OUTBOUND_TAG, _('Reject'));
    uci.sections(config_name, 'outbound', s => o.value(s.tag));

    s = parent.option(
        form.SectionValue,
        'route_rule',
        form.GridSection,
        'route_rule',
        _('Route Rules'))
        .subsection;
    s.addremove = true;
    s.anonymous = true;
    s.sortable = true;
    s.description = E('div', { style: 'color:red' }, _('Please note attention to the priority, the higher the order, the higher the priority.'));

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'tag');
        return _('Outbound Configuration') + ' » ' + (name ?? _('new rule'));
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'tag');

    s.addModalOptions = function (s, section_id) {
        if (!uci.get(config_name, section_id, 'tag')) {
            o = s.option(form.Value, 'tag', _('Rule Tag'));
            o.rmempty = false;
            o.datatype = 'string';
            o.validate = (section_id, value) => unique_tag('route_rule', section_id, value);
        }

        o = s.option(form.ListValue, 'outbound', _('Outbound'));
        o.value(REJECT_OUTBOUND_TAG, _('Reject'));
        uci.sections(config_name, 'outbound', s => o.value(s.tag));

        o = s.option(form.Flag, 'invert', _('Invert'), _('Invert match result.'));
        o.rmempty = false;

        const protocol_selections = {
            'HTTP': _('QUIC'),
            'TLS': _('TLS'),
            'QUIC': _('QUIC'),
            'STUN': _('STUN'),
            'BitTorrent': _('BitTorrent'),
        };

        o = s.option(form.MultiValue, 'protocol', _('Protocol'));
        Object.keys(protocol_selections).forEach(key => o.value(key, protocol_selections[key]));

        o = s.option(form.MultiValue, 'rule_set', _('Rule Sets'));
        uci.sections(config_name, 'rule_set', s => {
            if (s.sub !== '1' && s.type !== 'headless') {
                o.value(s.tag);
            }
        });
    };

    o = s.option(form.DummyValue, 'outbound');
    o.modalonly = false;
    o.textvalue = section_id => uci.get(config_name, section_id, 'outbound');

    o = s.option(form.DummyValue, 'protocol');
    o.modalonly = false;
    o.textvalue = section_id => {
        const protocols = uci.get(config_name, section_id, 'protocol');
        if (protocols) {
            return `<b>${_('Protocol')}: </b>` + protocols.join(', ');
        } else {
            return '';
        }
    }

    o = s.option(form.DummyValue, 'rule_set');
    o.modalonly = false;
    o.textvalue = section_id => {
        const rule_sets = uci.get(config_name, section_id, 'rule_set');
        if (rule_sets) {
            const text = `<b>${_('Rule Set')}: </b>` + rule_sets.join(', ');
            if (uci.get(config_name, section_id, 'invert') === '1') {
                return E('div', `<b><i>${_('Not Match')}</i></b> ${text}`);
            }

            return text;
        } else {
            return '';
        }
    }
}

function render_access_control_tab(parent) {
    const tabName = 'access_control';
    let s, o;
    parent.tab(tabName, _('Access Control'));

    o = parent.taboption(tabName, form.DummyValue, '_description_text', '');
    o.cfgvalue = function () { return E('div', _('Packets are shunted ahead of time before they enter the sing-box core')); };
    o.write = function () { };

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'access_control',
        form.NamedSection,
        'access_control',
        'sing_box',
        '')
        .subsection;

    o = s.option(form.ListValue, 'mode', _('Filter Mode'));
    o.value('0', _('Disable'));
    o.value('1', _('Blacklist'));
    o.value('2', _('Whitelist'));
    
    o = s.option(form.DynamicList, 'black_ip4addr', _('Blacklist IPv4 Address'));
    o.rmempty = false;
    o.depends('mode', '1');
    o.datatype = 'ip4addr';
    o = s.option(form.DynamicList, 'black_ip6addr', _('Blacklist IPv6 Address'));
    o.depends('mode', '1');
    o.datatype = 'ip6addr';
    o = s.option(form.DynamicList, 'black_macaddr', _('Blacklist MAC Address'));
    o.depends('mode', '1');
    o.datatype = 'macaddr';

    o = s.option(form.DynamicList, 'white_ip4addr', _('Whitelist IPv4 Address'));
    o.depends('mode', '2');
    o.datatype = 'ip4addr';
    o = s.option(form.DynamicList, 'white_ip6addr', _('Whitelist IPv6 Address'));
    o.depends('mode', '2');
    o.datatype = 'ip6addr';
    o = s.option(form.DynamicList, 'white_macaddr', _('Whitelist MAC Address'));
    o.depends('mode', '2');
    o.datatype = 'macaddr';
}

function render_dns_tab(parent) {
    const strategys = {
        'prefer_ipv4': _('Perfer IPv4'),
        'prefer_ipv6': _('Perfer IPv6'),
        'ipv4_only': _('IPv4 Only'),
        'ipv6_only': _('IPv6 Only'),
    };

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

    o = s.option(form.Flag, 'custom_default', _('Custom Default DNS'), _('The first dns server will be used if not set.'));
    o = s.option(form.ListValue, 'final', _('Default DNS'), _('Default dns server tag.'));
    o.depends('custom_default', '1');
    uci.sections(config_name, 'dns_server', s => o.value(s.tag));

    o = s.option(form.ListValue, 'strategy', _('Default Strategy'), _('Default domain strategy for resolving the domain names.'));
    Object.keys(strategys).forEach(key => o.value(key, strategys[key]));

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'dns_servers',
        form.GridSection,
        'dns_server',
        _('DNS Servers'))
        .subsection;
    s.addremove = true;
    s.anonymous = true;
    s.sortable = true;

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'tag');
        return _('DNS Server Configuration') + ' » ' + (name ?? _('new dns server'));
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'tag');

    s.addModalOptions = function (s, section_id) {
        if (!uci.get(config_name, section_id, 'tag')) {
            o = s.option(form.Value, 'tag', _('Server Tag'));
            o.rmempty = false;
            o.datatype = 'string';
            o.validate = (section_id, value) => {
                if (value !== DNS_FAKE_IP_TAG || value !== DNS_BLOCK_TAG || value.startsWith('DHCP')) {
                    return unique_tag('dns_server', section_id, value);
                }

                return _(`DNS Server tag couldn\'t be "${value}"`);
            }
        }

        o = s.option(form.ListValue, 'proto', _('Protocol'));
        o.rmempty = false;
        o.datatype = 'string';
        o.value('TCP', _('TCP'));
        o.value('UDP', _('UDP'));
        o.value('TLS', _('TLS'));
        o.value('HTTPS', _('HTTPS'));
        o.value('QUIC', _('QUIC'));
        o.value('HTTP3', _('HTTP3')); // validation.types
        o.default = 'UDP';

        o = s.option(form.Value, 'ip_address', _('Address'), _('IP Address'));
        o.depends('proto', 'TCP');
        o.depends('proto', 'UDP');
        o.depends('proto', undefined);
        o.depends({ proto: 'TLS', resolver: '0' });
        o.depends({ proto: 'HTTPS', resolver: '0' });
        o.depends({ proto: 'QUIC', resolver: '0' });
        o.depends({ proto: 'HTTP3', resolver: '0' });
        o.depends({ proto: 'TLS', resolver: undefined });
        o.depends({ proto: 'HTTPS', resolver: undefined });
        o.depends({ proto: 'QUIC', resolver: undefined });
        o.depends({ proto: 'HTTP3', resolver: undefined });
        o.ucioption = 'address';

        o = s.option(form.Value, 'domain', _('Address'), _('Domain Address'));
        o.depends({ proto: 'TLS', resolver: '1' });
        o.depends({ proto: 'HTTPS', resolver: '1' });
        o.depends({ proto: 'QUIC', resolver: '1' });
        o.depends({ proto: 'HTTP3', resolver: '1' });
        o.ucioption = 'address';

        o = s.option(form.ListValue, 'strategy', _('Strategy'), _('Default domain strategy for resolving the domain names.'));
        o.rmempty = false;
        Object.keys(strategys).forEach(key => o.value(key, strategys[key]));

        o = s.option(form.Flag, 'custom_detour', _('Custom Outbound'), _('Use custom outbound to the dns server.'));
        o = s.option(form.ListValue, 'detour', _('Outbound'), _('Tag of an outbound for connecting to the dns server.'));
        o.depends('custom_detour', '1');
        o.rmempty = false;
        uci.sections(config_name, 'outbound', s => o.value(s.tag));

        o = s.option(form.Flag, 'resolver', _('Resolver'), _('Required if address contains domain'));
        o.rmempty = false;
        o.depends('proto', 'TLS');
        o.depends('proto', 'HTTPS');
        o.depends('proto', 'QUIC');
        o.depends('proto', 'HTTP3');

        o = s.option(form.ListValue, 'resolver_tag', _('Resolver Tag'), _('Tag of a another server to resolve the domain name in the address.'));
        o.rmempty = false;
        o.depends('resolver', '1');
        o.value(_('DHCP'));
        uci.sections(config_name, 'dns_server', s => {
            if (s['.name'] !== section_id) {
                o.value(s.tag);
            }
        });

        o = s.option(form.ListValue, 'resolver_strategy', _('Resolver Strategy'), _('The domain strategy for resolving the domain name in the address.'));
        o.rmempty = false;
        o.depends('resolver', '1');
        Object.keys(strategys).forEach(key => o.value(key, strategys[key]));
    };

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'dns_rules',
        form.GridSection,
        'dns_rule',
        _('DNS Rules'))
        .subsection;
    s.addremove = true;
    s.anonymous = true;
    s.sortable = true;

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'tag');
        return _('DNS Rule Configuration') + ' » ' + (name ?? _('new dns rule'));
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'tag');

    s.addModalOptions = function (s, section_id) {
        if (!uci.get(config_name, section_id, 'tag')) {
            o = s.option(form.Value, 'tag', _('Rule Tag'));
            o.rmempty = false;
            o.datatype = 'string';
            o.validate = (section_id, value) => unique_tag('dns_server', section_id, value);
        }

        o = s.option(form.ListValue, 'server', _('Server'));
        uci.sections(config_name, 'dns_server', s => o.value(s.tag));

        o = s.option(form.MultiValue, 'rule_set', _('Rule Sets'));
        uci.sections(config_name, 'rule_set', s => {
            if (s.sub !== '1' && s.type !== 'headless') {
                o.value(s.tag);
            }
        });
        o.value(DNS_BLOCK_TAG, 'BLOCK');
    }
}

function render_outbound_tab(parent, wanInterfaces, lanInterfaces) {
    const tabName = 'outbound';
    let s, o;

    parent.tab(tabName, _('Outbound Settings'));

    s = parent.taboption(
        tabName,
        form.SectionValue,
        'outbounds',
        form.GridSection,
        'outbound')
        .subsection;
    s.addremove = true;
    s.anonymous = true;
    s.sortable = true;

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'tag');
        return _('Outbound Configuration') + ' » ' + (name ?? _('new outbound'));
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'tag');

    s.addModalOptions = function (s, section_id) {
        if (!uci.get(config_name, section_id, 'tag')) {
            o = s.option(form.Value, 'tag', _('Outbound Tag'));
            o.rmempty = false;
            o.datatype = 'string';
            o.validate = (section_id, value) => {
                if (value !== 'any' || value !== DNS_OUTBOUND_TAG || value !== REJECT_OUTBOUND_TAG) {
                    return unique_tag('outbound', section_id, value);
                }

                return _(`Outbound tag couldn\'t be "${value}"`);
            }
        }

        o = s.option(form.ListValue, 'type', _('Outbound Type'));
        o.rmempty = false;
        o.datatype = 'string';
        o.value('direct', _('Direct'));
        o.value('node', _('Node'));
        o.value('urltest', _('URLTest'));
        o.default = 'direct';

        o = s.option(form.ListValue, 'interface', _('Outbound Interface'));
        o.rmempty = false;
        o.depends('type', 'direct');
        wanInterfaces.forEach(element => {
            let ifname = element.getIfname();
            o.value(ifname, `${element.sid} (${ifname})`);
        });

        o = s.option(form.ListValue, 'node', _('Outbound Node'));
        o.rmempty = false;
        o.depends('type', 'node');
        uci.sections(config_name, 'node', (s, section_id) => {
            let value = section_id;
            if (s.group) {
                value = s.hashkey;
            }
            o.value(value, s.alias);
        });

        o = s.option(form.ListValue, 'outbound', _('Outbound Tag'));
        o.rmempty = false;
        o.depends('type', 'node');
        uci.sections(config_name, 'outbound', s => {
            if (s.type == 'direct') {
                o.value(s.tag);
            }
        });

        o = s.option(form.MultiValue, 'include', _('Include Outbound'), _('List of outbound tags to test.'));
        o.rmempty = false;
        o.depends('type', 'urltest');
        uci.sections(config_name, 'outbound', s => {
            if (s.type !== 'urltest' && s['.name'] !== section_id) {
                o.value(s.tag);
            }
        });

        o = s.option(form.Value, 'url', _('Test Url'), _('The URL to test.'));
        o.rmempty = false;
        o.depends('type', 'urltest');
        o.value('https://www.gstatic.com/generate_204');
        o.value('https://www.apple.com/library/test/success.html');
        o.value('https://connectivitycheck.platform.hicloud.com/generate_204');
        o.value('https://wifi.vivo.com.cn/generate_204');
    };

    o = s.option(form.DummyValue, 'outbound_config');
    o.modalonly = false;
    o.textvalue = function (section_id) {
        const type = uci.get(config_name, section_id, 'type');
        switch (type) {
            case 'direct':
                const ifname = uci.get(config_name, section_id, 'interface');
                const element = wanInterfaces.find(element => element.getIfname() === ifname);
                return `${element.sid} (${ifname})`;

            case 'node':
                let node = uci.get(config_name, section_id, 'node');
                if (!node.startsWith('cfg')) {
                    uci.sections(config_name, 'node', (s, section_id) => {
                        if (s.group && s.hashkey === node) {
                            node = section_id;
                        }
                    });
                }
                return uci.get(config_name, node, 'alias');

            case 'urltest':
                return _('URLTest') + ': ' + uci.get(config_name, section_id, 'include').join(', ')
            default: return 'unkown';
        }
    };
}

function render_nodes_tab(parent) {
    const tabName = 'nodes';
    let s, o;

    parent.tab(tabName, _('Node List'));

    o = parent.taboption(tabName, form.DummyValue, '_nodes_info', '');
    o.cfgvalue = function (section_id) {
        const nodes = uci.sections(config_name, 'node');

        if (nodes && Array.isArray(nodes)) {
            const groups = nodes.reduce((groups, outbound) => {
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
            let text = `${_('Manual Add')}: ${nodes.length - count}`;
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
                        return parent.map.save(null, true);
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
        const group_tag = uci.get(config_name, section_id, 'group');

        if (group_tag) {
            return group_tag;
        } else {
            return '';
        }
    };
}

function render_subscription_tab(parent) {
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
            o.value(5, _('Global Filter'));
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
    s.anonymous = true;
    s.sortable = true;
    s.description = E('div', { style: 'color:red' }, _('Please input the subscription url first, save and submit before manual subscription.'))

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'tag');
        return _('Subscription Configuration') + ' » ' + (name ?? _('new subscription'));
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'tag');

    s.addModalOptions = function (s, section_id) {
        if (!uci.get(config_name, section_id, 'tag')) {
            o = s.option(form.Value, 'tag', _('Subscription Name'));
            o.rmempty = false;
            o.datatype = 'string';
            o.validate = (section_id, value) => unique_tag('subscription', section_id, value);
        }

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

    o = s.option(form.DummyValue, '_subscribe_count', _('Count'));
    o.modalonly = false;
    o.textvalue = function (section_id) {
        const nodes = uci.sections(config_name, 'node');
        const tag = uci.get(config_name, section_id, 'tag');
        if (nodes && Array.isArray(nodes)) {
            return nodes.filter(section => section.group === tag).length;
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
                const outbounds = uci.sections(config_name, 'node', s => {
                    if (s.group === section_id) {
                        parent.map.data.remove(config_name, section_id);
                    }
                });

                return parent.map.save(null, true);
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
                    const res = await callSubscribe(section_id);
                    uci.unload(config_name);
                    await uci.load(config_name);
                    const arr = Object.keys(res).map(key => `${res[key].alias}`);
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

                return parent.map.save(null, true);
            }),
            title: _('Manual Subscribe'),
        }, _('Manual Subscribe'));
    };
}

function render_rule_set_tab(parent) {
    const tabName = 'rule_set';
    let s, o;

    parent.tab(tabName, _('Rule Set'));

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

    const rule_set_type_selections = {
        'inline': _('Inline'),
        'headless': _('Headless Rule'),
        'local': _('Local File'),
        'remote': _('Remote File'),
    };

    const format_selections = {
        'binary': _('Binary Format'),
        'source': _('Source Format'),
    };

    o = parent.taboption(tabName, form.DummyValue, '_description_text', '');
    o.cfgvalue = function (section_id) {
        return E('div', `${_('The default rule uses the following matching logic:')}
        ${_('Network')} && ${_('Protocol')} && ${_('Source IP')} && ${_('Source Port')} &&
        ${_('Dest IP')} && ${_('Dest Port')} && ${_('Domain List')}`);
    };

    o.cfgvalue = function () {
        return E('div', `${_('see document <a herf="https://sing-box.sagernet.org/zh/configuration/rule-set/">here</a>')}`);
    };
    o.write = function () { };

    s = parent.taboption(tabName, form.SectionValue, 'rule_set', form.GridSection, 'rule_set').subsection;
    s.addremove = true;
    s.anonymous = true;
    s.sortable = true;

    s.modaltitle = function (section_id) {
        let name = uci.get(config_name, section_id, 'tag');
        return _('Rule Set Configuration') + ' » ' + (name ?? _('new ruleset'));
    };

    s.sectiontitle = section_id => uci.get(config_name, section_id, 'tag');

    s.addModalOptions = function (s, section_id) {
        if (!uci.get(config_name, section_id, 'tag')) {
            o = s.option(form.Value, 'tag', _('Rule Set Tag'));
            o.rmempty = false;
            o.datatype = 'string';
            o.validate = (section_id, value) => unique_tag('rule_set', section_id, value);
        }

        o = s.option(form.ListValue, 'type', _('Rule Set Type'));
        Object.keys(rule_set_type_selections).forEach(key => o.value(key, rule_set_type_selections[key]));

        const headless_rule_tags = [];

        uci.sections(config_name, 'rule_set', s => {
            if (s.type === 'headless' && s.sub !== '1' && s['.name'] !== section_id) {
                headless_rule_tags.push(s.tag);
            }
        });

        if (headless_rule_tags.length > 0) {
            o = s.option(form.Flag, 'advance', _('Advance Mode'));
            o.rmempty = false;
            o.depends('type', 'inline');
            o.modalonly = true;

            o = s.option(form.MultiValue, 'headless', _('Headless rules'));
            o.depends({ type: 'inline', advance: '1' });
            o.modalonly = true;
            headless_rule_tags.forEach(tag => o.value(tag));
        } else {
            uci.set(config_name, section_id, 'advance', null);
        }

        o = s.option(form.ListValue, 'format', _('Rule Set Format'));
        o.depends('type', 'local');
        o.depends('type', 'remote');
        Object.keys(format_selections).forEach(key => o.value(key, format_selections[key]));

        o = s.option(form.Value, 'path', _('File Path'));
        o.depends('type', 'local');

        o = s.option(form.Value, 'url', _('Download URL'), _('Download URL of rule-set. Will auto update everyday'));
        o.depends('type', 'remote');

        o = s.option(form.Flag, 'cutom_detour', _('Custom Download Outbound'), _('Use custom outbound to download rule-set.'));
        o.depends('type', 'remote');

        o = s.option(form.ListValue, 'download_detour', _('Download Outbound'), _('Tag of the outbound to download rule-set.'));
        o.depends('cutom_detour', '1');
        uci.sections(config_name, 'outbound', s => o.value(s.tag));

        o = s.option(form.Flag, 'sub', _('Sub Rule Set'), _('Is this part of another rule set.'));
        o.depends('type', 'headless');
        o.rmempty = false;

        o = s.option(form.Flag, 'invert', _('Invert'), _('Invert match result.'));
        o.depends('type', 'headless');
        o.depends({ type: 'inline', advance: '0' });
        o.depends({ type: 'inline', advance: undefined });
        o.rmempty = false;

        const sub_rule_tags = [];
        uci.sections(config_name, 'rule_set', s => {
            if (s.type === 'headless' && s.sub === '1' && s['.name'] !== section_id) {
                sub_rule_tags.push(s.tag);
            }
        });

        if (sub_rule_tags.length > 1) {
            o = s.option(form.ListValue, 'logical_mode', _('Logical Mode'));
            o.depends({ sub: '0', type: 'headless' });
            o.depends({ type: 'inline', advance: '0' });
            o.depends({ type: 'inline', advance: undefined });
            Object.keys(logical_mode_selections).forEach(key => o.value(key, logical_mode_selections[key]));

            o = s.option(form.MultiValue, 'sub_rule', _('Sub rules'));
            o.depends('logical_mode', '1');
            o.depends('logical_mode', '2');
            o.modalonly = true;
            sub_rule_tags.forEach(tag => o.value(tag));
        } else {
            uci.set(config_name, section_id, 'logical_mode', 0);
        }

        function headless_config_depends(o) {
            o.depends({ logical_mode: '0', type: 'headless' });
            o.depends({ logical_mode: undefined, type: 'headless' });
            o.depends({ logical_mode: '0', type: 'inline', advance: '0' });
            o.depends({ logical_mode: undefined, type: 'inline', advance: '0' });
            o.depends({ logical_mode: '0', type: 'inline', advance: undefined });
            o.depends({ logical_mode: undefined, type: 'inline', advance: undefined });
        }

        o = s.option(form.ListValue, 'network', _('Network'));
        headless_config_depends(o);
        Object.keys(network_selections).forEach(key => o.value(key, network_selections[key]));

        o = s.option(form.DynamicList, 'source', _('Source IP'), `${_('Example')}:<br />- ${_('IP')}: 192.168.1.100<br />- ${_('IP CIDR')}: 192.168.1.0/24`);
        headless_config_depends(o)
        o.datatype = 'ipaddr';
        o = s.option(form.DynamicList, 'source_port', _('Source Port'), `${_('Example')}:<br />- ${_('Port')}: 80<br />- ${_('Range')}: 1000-2000`);
        headless_config_depends(o)
        o.datatype = 'portrange';

        o = s.option(form.DynamicList, 'dest', _('Dest IP'), `${_('Example')}:<br />- ${_('IP')}: 192.168.1.100<br />- ${_('IP CIDR')}: 192.168.1.0/24`);
        headless_config_depends(o)
        o.datatype = 'ipaddr';
        o = s.option(form.DynamicList, 'dest_port', _('Dest Port'), `${_('Example')}:<br />- ${_('Port')}: 80<br />- ${_('Range')}: 1000-2000`);
        headless_config_depends(o)
        o.datatype = 'portrange';

        o = s.option(form.TextValue, 'domain', _('Domain List'));
        headless_config_depends(o)
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
    };
    o = s.option(form.DummyValue, '_rule_set_view');
    o.modalonly = false;
    o.textvalue = function (section_id) {
        const description = [];

        const type = uci.get(config_name, section_id, 'type');

        description.push(
            E('br'),
            E('b', `${_('Rule Set Type')}: `),
            `${rule_set_type_selections[type]}`,
        );

        if (type !== 'inline' && type !== 'headless') {
            description.push(
                E('br'),
                E('b', `${_('Rule Set Format')}: `),
                `${format_selections[uci.get(config_name, section_id, 'format')]}`,
            );
        }

        if (type === 'local') {
            description.push(
                E('br'),
                E('b', `${_('File Path')}: `),
                uci.get(config_name, section_id, 'path'),
            );
        } else if (type === 'remote') {
            description.push(
                E('br'),
                E('b', `${_('Download Url')}: `),
                uci.get(config_name, section_id, 'url'),
            );
        } else if (type === 'headless' || (type === 'inline' && uci.get(config_name, section_id, 'advance') !== '1')) {
            if (type === 'headless') {
                description.push(
                    E('br'),
                    E('b', `${_('Sub Rule Set')}: `),
                    `${uci.get(config_name, section_id, 'sub') === '1' ? _('Yes') : _('No')}`,
                );
            }

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
        } else if (type === 'inline') {
            description.push(
                E('br'),
                E('b', `${_('Headless rules')}: `),
                uci.get(config_name, section_id, 'headless').join(', '),
            );
        }

        return E('div', description);
    };
}

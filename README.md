# sblite

Yet another singbox(>= 1.10) client on OpenWrt, only implemented part of the full functions.

This repository is under development and cannot be used properly.

## Rule Set

[MetaCubeX/meta-rules-dat/sing/geo](https://github.com/MetaCubeX/meta-rules-dat/tree/sing/geo)

## Uci config

### sing_box main

### sing_box route

### sing_box dns

### sing_box subscribe

### route_rule

### dns_server

### dns_rule

### outbound

### node

### subscription

### rule_set

- **tag** Rule Set Tag
- **type** Rule Set Type
    - `inline`
    - `local`
    - `remote`
- **format** Rule Set Format *depends: `type` in `local` or `remote`*
    - `binary`
    - `source`
- **sub** Is this part of another rule set. *depends: `type` in `inline` and `logical_mode` is `0`(Close)*

## TODO:

- [ ] init.d script
- [ ] sing-box config generate
- [x] subscribe cron job
- [ ] other cron job
- [ ] Makefile
- [ ] DNS config
- [x] Rule set

## Tanks

- [@SagerNet/sing-box](https://github.com/SagerNet/sing-box)
- [@jarryson/singbox-subscribe](https://github.com/jarryson/singbox-subscribe)
- [@xiaorouji/openwrt-passwall2](https://github.com/xiaorouji/openwrt-passwall2)
- [@immortalwrt/homeproxy](https://github.com/immortalwrt/homeproxy)
- [@MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)

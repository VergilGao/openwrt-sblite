let filter = [
    '(0|9)',
    '(QQ)',
];

filter = map(filter, str => replace(str, /[\\.*+?^$|\[(){}]/g, '\\$&'));

const str = '902349u8(0|9)084702';

const exp= regexp(join('|', filter));
print(exp + '\n');
print(match(str, exp));
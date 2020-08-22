function getStyle(element) {
    if (!element.style) {
        element.style = {};
    }

    for (let prop in element.computedStyle) {
        element.style[prop] = element.computedStyle[prop].value;

        // px 转成数字
        if (element.style[prop].toString().match(/px$/)) {
            element.style[prop] = parseInt(element.style[prop]);
        }
        // 字符串也转成数字
        if (element.style[prop].toString().match(/^[0-9\.]$/)) {
            element.style[prop] = parseInt(element.style[prop]);
        }
    }
    return element.style;
}

function layout(element) {
    if (!element.computedStyle) {
        return;
    }
    let elementStyle = getStyle(element);

    // toy browser 只处理 flex 布局
    if (elementStyle.display !== 'flex') {
        return;
    }

    // 正式代码开始了
    // 过滤出文本节点
    let childItems = element.children
        .filter(e => e.type === 'element')
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    let style = elementStyle;

    ['width', 'height'].forEach(size => {
        if (style[size] === 'auto' || style[size] === '') {
            style[size] = null;
        }
    });
    // 添加默认值
    if (!style.flexDirection || style.flexDirection === 'auto') {
        style.flexDirection = 'row';
    }
    if (!style.alignItems || style.alignItems === 'auto') {
        style.alignItems = 'stretch';
    }
    if (!style.justifyContent || style.justifyContent === 'auto') {
        style.justifyContent = 'flex-start';
    }
    if (!style.flexWrap || style.flexWrap === 'auto') {
        style.flexWrap = 'nowrap';
    }
    if (!style.alignContent || style.alignContent === 'auto') {
        style.alignContent = 'stretch';
    }

    //设置计算排版时候用到的属性
    let mainSize, mainStart, mainEnd, mainSign, mainBase; // 主轴的参数
    let crossSize, crossStart, crossEnd, crossSign, crossBase; // 交叉轴的参数
    if (style.flexDirection === 'row') {
        mainSize = 'width'; //row是横向的排版，所以用width去计算主轴的尺寸
        mainStart = 'left';
        mainEnd = 'right';
        mainSign = +1; // 可能是 +1 或者 -1。+1 是为了强调
        mainBase = 0; // 与 mainBase 是一对

        crossSize = 'height';
        crossStart = 'top';
        crossEnd = 'bottom';
    } else if (style.flexDirection === 'row-reverse') {
        mainSize = 'width';
        mainStart = 'right';
        mainEnd = 'left';
        mainSign = -1;
        mainBase = style.width;

        crossSize = 'height';
        crossStart = 'top';
        crossEnd = 'bottom';
    } else if (style.flexDirection === 'column') {
        mainSize = 'height';
        mainStart = 'top';
        mainEnd = 'bottom';
        mainSign = +1;
        mainBase = 0;

        crossSize = 'width';
        crossStart = 'left';
        crossEnd = 'right';
    } else if (style.flexDirection === 'column-reverse') {
        mainSize = 'height';
        mainStart = 'bottom';
        mainEnd = 'top';
        mainSign = -1;
        mainBase = style.height;

        crossSize = 'width';
        crossStart = 'left';
        crossEnd = 'right';
    }

    if (style.flexWrap === 'wrap-reverse') {
        let tmp = crossStart;
        crossStart = crossEnd;
        crossEnd = tmp;
        crossSign = -1;
    } else {
        crossBase = 0;
        crossSign = 1;
    }

    // 父元素没有设置主轴尺寸
    let isAutoMainSize = false;
    if (!style[mainSize]) {
        elementStyle[mainSize] = 0;
        for (let i = 0; i < childItems.length; i++) {
            let item = childItems[i];
            let itemStyle = getStyle(item);
            if (itemStyle[mainSize] !== null || itemStyle[crossSize] !== (void 0)) {
                elementStyle[mainSize] = elementStyle[mainSize] + itemStyle[mainSize];
            }
        }
        isAutoMainSize = true;
    }
    //var itemStyle;

    let flexLine = [];
    let flexLines = [flexLine];
    let mainSpace = elementStyle[mainSize]; //主轴的剩余空间
    let crossSpace = 0; //交叉轴的尺寸
    for (let i = 0; i < childItems.length; i++) {
        let item = childItems[i];
        let itemStyle = getStyle(item);
        if (itemStyle[mainSize] === null) {
            itemStyle[mainSize] = 0;
        }

        if (itemStyle.flex) { // 并不是 display: flex，而是 flexItem 设置的 flex: 1 这种
            flexLine.push(item);
        } else if (style.flexWrap === 'nowrap' && isAutoMainSize) {
            //更新主轴剩余尺寸
            mainSpace -= itemStyle[mainSize];
            if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== (void 0)) {
                //行高由行内最高的一个元素决定
                crossSpace = Math.max(crossSpace, itemStyle[crossSize]);
            }
            flexLine.push(item);
        } else {
            //元素尺寸大于行的情况，压缩到行的大小
            if (itemStyle[mainSize] > style[mainSize]) {
                itemStyle[mainSize] = style[mainSize];
            }
            //主轴的空间放不下了
            if (mainSpace < itemStyle[mainSize]) {
                flexLine.mainSpace = mainSpace;
                flexLine.crossSpace = crossSpace;
                //创建新一行
                flexLine = [item];
                flexLines.push(flexLine);
                //重置尺寸变量
                mainSpace = style[mainSpace];
                crossSpace = 0;
            } else {
                flexLine.push(item);
            }
            if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== (void 0)) {
                crossSpace = Math.max(crossSpace, itemStyle[crossSize]);
            }
            mainSpace -= itemStyle[mainSize];
        }
    }
    flexLine.mainSpace = mainSpace;

    if (style.flexWrap === 'nowrap' || isAutoMainSize) {
        flexLine.crossSpace = (style[crossSize] !== void 0) ? style[crossSize] : crossSpace;
    } else {
        flexLine.crossSpace = crossSpace;
    }

    // 等比压缩
    if (mainSpace < 0) { //单行
        let scale = style[mainSize] / (style[mainSize] - mainSpace); // elementStyle[mainSize]：容器主轴尺寸
        let currentMain = mainBase;
        for (let i = 0; i < childItems.length; i++) {
            let item = childItems[i];
            let itemStyle = getStyle(item);
            if (itemStyle.flex) {
                itemStyle[mainSize] = 0;
            }
            itemStyle[mainSize] = itemStyle[mainSize] * scale;
            itemStyle[mainStart] = currentMain;
            itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
            currentMain = itemStyle[mainEnd];
        }
    } else { // 多行的情况
        flexLines.forEach(function (items) {
            let mainSpace = items.mainSpace;
            let flexTotal = 0; //统计当前行的flex元素数量
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let itemStyle = getStyle(item);
                if ((itemStyle.flex !== null) && (itemStyle.flex !== void 0)) {
                    flexTotal += itemStyle.flex;
                    continue;
                }
            }

            if (flexTotal > 0) {
                let currentMain = mainBase;
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let itemStyle = getStyle(item);
                    if (itemStyle.flex) {
                        itemStyle[mainSize] = (mainSpace / flexTotal) * itemStyle.flex;
                    }
                    itemStyle[mainStart] = currentMain;
                    itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
                    currentMain = itemStyle[mainEnd];
                }
            } else {
                if (style.justifyContent === 'flex-start') {
                    var currentMain = mainBase;
                    var step = 0;
                } else if (style.justifyContent === 'flex-end') {
                    var currentMain = mainSpace * mainSign + mainBase;
                    var step = 0;
                } else if (style.justifyContent === 'center') {
                    var currentMain = mainSpace / 2 * mainSign + mainBase;
                    var step = 0;
                } else if (style.justifyContent === 'space-between') {
                    var currentMain = mainBase;
                    var step = mainSpace / (items.length - 1) * mainSign;
                } else if (style.justifyContent === 'space-around') {
                    var step = mainSpace / (items.length) * mainSign;
                    var currentMain = step / 2 + mainBase;
                }

                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let itemStyle = getStyle(item);
                    itemStyle[mainStart] = currentMain;
                    itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
                    currentMain = itemStyle[mainEnd] + step;
                }
            }
        });
    }

    // 计算交叉轴
    // align-items, align-self
    crossSpace = 0;
    if (!style[crossSize]) {
        crossSpace = 0;
        elementStyle[crossSize] = 0;
        //auto模式，每个行的交叉轴尺寸相加得出
        for (let i = 0; i < flexLines.length; i++) {
            elementStyle[crossSize] = elementStyle[crossSize] + flexLines[i].crossSize;
        }
    } else {
        crossSpace = style[crossSize];
        //已经声明交叉轴尺寸，减去每个行占用得出剩余尺寸
        for (let i = 0; i < flexLines.length; i++) {
            crossSpace -= flexLines[i].crossSize;
        }
    }

    if (style.flexWrap === 'wrap-reverse') {
        crossBase = style[crossSize] || 0;
    } else {
        crossBase = 0;
    }
    let lineSize = style[crossSize] / flexLines.length;

    let step; // 每个元素的间隔距离
    if (style.alignContent === 'flex-start') {
        crossBase += 0;
        step = 0;
    } else if (style.alignContent === 'flex-end') {
        crossBase += crossSign * crossSpace;
        step = 0;
    } else if (style.alignContent === 'center') {
        crossBase += crossSign * crossSpace / 2;
        step = 0;
    } else if (style.alignContent === 'space-between') {
        crossBase += 0;
        step = crossSpace / (flexLines.length - 1);
    } else if (style.alignContent === 'space-around') {
        step = crossSpace / (flexLines.length);
        crossBase += crossSign * step / 2;
    } else if (style.alignContent === 'stretch') {
        crossBase += 0;
        step = 0;
    }

    flexLines.forEach(items => {
        let lineCrossSize = style.alignContent === 'stretch' ?
            items.crossSpace + crossSpace / flexLines.length :
            items.crossSpace;
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let itemStyle = getStyle(item);
            let align = itemStyle.alignSelf || style.alignItems;
            if (itemStyle[crossSize] === null) {
                itemStyle[crossSize] = (align === 'stretch') ? lineCrossSize : 0;
            }
            if (align === 'flex-start') {
                itemStyle[crossStart] = crossBase;
                itemStyle[crossEnd] = itemStyle[crossStart] + crossSign * itemStyle[crossSize];
            } else if (align === 'flex-end') {
                itemStyle[crossEnd] = crossBase + crossSign * lineCrossSize;
                itemStyle[crossStart] = itemStyle[crossEnd] - crossSign * itemStyle[crossSize];
            } else if (align === 'center') {
                itemStyle[crossStart] = crossBase + crossSign * (lineCrossSize - itemStyle[crossSize]) / 2;
                itemStyle[crossEnd] = itemStyle[crossStart] + crossSign * itemStyle[crossSize];
            } else if (align === 'stretch') {
                void 0;
                itemStyle[crossStart] = crossBase;
                itemStyle[crossEnd] = crossBase + crossSign * ((itemStyle[crossSize] !== null && itemStyle[crossSize] !== (void 0)) ? itemStyle[crossSize] : items.crossSpace);
                itemStyle[crossSize] = crossSign * (itemStyle[crossEnd] - itemStyle[crossStart])
            }
        }
        crossBase += crossSign * (lineCrossSize + step);
    });

    console.log(childItems);

}

module.exports = layout;
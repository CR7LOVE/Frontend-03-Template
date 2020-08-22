学习笔记

本周学习内容：
 
 1. layout ，生成 DOM with position 
 2. render ，生成 Bitmap。本来是要绘制到浏览器的，这里做了简化处理，用了外部的 images 库，用来生成一张图片。
 
到此浏览器原理部分就结束了，通过 3 周的课程，我对浏览器从 url 到显示的整个过程有了更好的理解。

再来回顾一下原理：

url => 服务端返回 html 代码 => 解析成 dom => 经过 css 计算，有了dom with css => 经过布局，有了dom with postion => render => Bitmap
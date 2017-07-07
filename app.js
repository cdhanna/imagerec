console.log('hello world');

var fs = require('fs'),
    PNG = require('node-png').PNG;

var clipA = undefined;
var clipB = undefined;
fs.createReadStream('image-rec-test2.png')
    .pipe(new PNG({
        filterType: 4
    }))
    .on('parsed', function() {
 
        var data = this.data;
        var width = this.width;

        // remove green/blue component
        var maxRed = 0;
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = (this.width * y + x) << 2;
 
                this.data[idx + 0] *= 1;
                this.data[idx + 1] *= 0;
                this.data[idx + 2] *= 0;

                if (this.data[idx + 0] > maxRed){
                    maxRed = this.data[idx + 0];
                }
                
            }
        }


        // only consider high ranking red values. Anything above 90%
        var threshold = .01;
        var minRedThreshold = maxRed * (1 - threshold)
        console.log('red threshold ', minRedThreshold, maxRed)
        for (var y = 0 ; y < this.height ; y ++){
            for (var x = 0 ; x < this.width; x ++){
                var idx = (this.width * y + x) << 2;
                
                var red = this.data[idx + 0];
                if (red > minRedThreshold){
                    red = 255;
                } else red = 0;
                this.data[idx + 0] = red;
            }

        }

        // find the outer corners
        var minLeft = this.width;
        var minTop = this.height; 
        var minBot = 0;
        var minRight = 0;

        for (var y = 0 ; y < this.height ; y ++ ){
            for (var x = 0; x < this.width; x ++){
                var idx = (this.width * y + x) << 2;

                var red = this.data[idx];
                if (red == 255){
                    if (x < minLeft) {
                        minLeft = x;
                    }

                    if (y < minTop){
                        minTop = y;
                    }

                    if (y > minBot){
                        minBot = y;
                    }

                    if (x > minRight){
                        minRight = x;
                    }
                }                
            }
        }


        function getInner(startX, startY, stages){
            var x = startX;
            var y = startY;
            for(var i = 0 ; i < stages.length ; i ++){
                var stage = stages[i];
                
                var keepGoing = stage.goOnRed;
                if (keepGoing == undefined){
                    keepGoing = true;
                }
                var isRed = keepGoing;
                while (isRed == keepGoing){
                    x += stage.x || 0;
                    y += stage.y || 0;
                    var idx = (width * y + x) << 2;
                    isRed = data[idx] == 255
                }
                x += stage.postX || 0;
                y += stage.postY || 0;
            }
            return {
                x: x, 
                y: y
            }
        }
        var clipA = getInner(minLeft, minTop, [
            {
                x: 1,
                postX: -1
            },
            {
                y: 1,
            },
            {
                x: -1,
                postX: 1,
                postY: 1,
                goOnRed: false
            }
        ])
        var clipB = getInner(minRight, minBot, [
            {
                x: -1,
                postX: 1
            }, 
            {
                y: -1
            }, 
            {
                x: 1,
                postX: -1,
                postY: 1,
                goOnRed: false
            }
        ]);

        // DEBUG ONLY add markers 
        var markers = [
            {x: minLeft, y: minTop, color: 2},
            {x: minLeft, y: minBot, color: 2},
            {x: minRight, y: minBot, color: 2},
            {x: minRight, y: minTop, color: 2},
            {x: clipA.x, y: clipA.y, color: 1},
            {x: clipB.x, y: clipB.y, color: 1},
        ]
        for (var m = 0 ; m < markers.length ; m ++){
            var marker = markers[m];
            for (var y = 0 ; y < this.height ; y ++ ){
                for (var x = 0; x < this.width; x ++){
                    var idx = (this.width * y + x) << 2;

                    // distance to marker 
                    var squaredDist = Math.pow( x - marker.x, 2) + Math.pow( y - marker.y, 2)
                    if (squaredDist < 36){
                        this.data[idx + marker.color] = 255
                    }
                }          
            }
        }
        console.log('topleft ', minLeft, minTop);
        console.log('botleft ', minLeft, minBot);
        this.pack().pipe(fs.createWriteStream('out3.png'));


        var output = new PNG({
            width: clipB.x - clipA.x,
            height: clipB.y - clipA.y,
            filterType: 4,
            // data: []
        })
        fs.createReadStream('image-rec-test2.png')
            .pipe(new PNG({
                filterType: 4
            }))
            .on('parsed', function() {
                this.bitblt(output, clipA.x, clipA.y, output.width, output.height, 0, 0)
                output.pack().pipe(fs.createWriteStream('output.png'))
            })


    });
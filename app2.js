var fs = require('fs'),
    PNG = require('node-png').PNG;

var name = 'advanced4';
var inputName = './samples/' + name + '.png';
var outputName = './output/' + name + '.png';
var traceName = './output/' + name + '-trace.png';


fs.createReadStream(inputName)
    .pipe(new PNG({
        filterType: 4
    }))
    .on('parsed', function(){

        var width = this.width;
        var height = this.height;
        var data = this.data; 

        
        var redOnly = superRed(data, width, height)
        corners = trace(redOnly, width, height);
        console.log('all corners', corners)

        var outputSize = {
            x: 950,
            y: 560
        }

        var outputData = affine(data, width, height, corners, outputSize);

        this.data = data;
        /* start at the center point of the image
            and go left, until you find red
        */ 

        var output = new PNG({
            width: outputSize.x,
            height: outputSize.y,
            filterType: 4
        })
        output.data = outputData;
        output.pack().pipe(fs.createWriteStream(outputName))

        // this.pack().pipe(fs.createWriteStream(outputName));
    })


function id(width, x, y){
    return (width * y + x) << 2;
}

function unit(v){
    return scale(v, 1 / length(v) )
}

function length(v){
    return Math.sqrt( Math.pow(v.x, 2) + Math.pow(v.y, 2));
}

function scale(v, s){
    return {
        x: v.x * s,
        y: v.y * s
    }
}

function add(a, b){
    return {
        x: a.x + b.x,
        y: a.y + b.y
    }
}
function subtract(a, b){
    return {
        x: a.x - b.x,
        y: a.y - b.y
    }
}

function affine(originalData, width, height, corners, resolution){
    // var data = [];
    var data = new Buffer(4 * resolution.x * resolution.y)
    var dataLength = resolution.x * resolution.y;

    var topDiff = subtract(corners[1], corners[0])
    var lowDiff = subtract(corners[2], corners[3])
    var leftDiff = subtract(corners[3], corners[0])
    var rightDiff = subtract(corners[2], corners[1])

    var topUnit = unit(topDiff);
    var lowUnit = unit(lowDiff);
    var leftUnit = unit(leftDiff);
    var rightUnit = unit(rightDiff);


    for (var x = 0.0 ; x < resolution.x ; x += 1.0){
        for (var y = 0.0 ; y < resolution.y ; y += 1.0){

            var outputId = id(resolution.x, x, y);
            var u = (x / resolution.x) ;
            var v = (y / resolution.y) ;

            var w = undefined, z = undefined; 

            var wVec = add(
                scale(lowUnit, v * u * length(lowDiff)),
                scale(topUnit, (1-v) * u * length(topDiff))
            )
            var zVec = add(
                scale(rightUnit, v * u * length(rightDiff)),
                scale(leftUnit, (1-u) * v * length(leftDiff))
            )

            var startingY = ((1-u) * corners[0].y) + (u * corners[1].y)
            var startingX = ((1-v) * corners[0].x) + (v * corners[3].x)

            var w = startingX + wVec.x
            var z = startingY + zVec.y;
           
            var sampleId = id(width, Math.round(w), Math.round(z))
            data[outputId + 0] = originalData[sampleId + 0]
            data[outputId + 1] = originalData[sampleId + 1]
            data[outputId + 2] = originalData[sampleId + 2]
            data[outputId + 3] = originalData[sampleId + 3]

        }
    }


    return data;
}

function trace(originalData, width, height){
    var data = originalData.map(function(x){return x;})

    var center = {
        x: width/2,
        y: height/2
    };
    var corners = [];

    var y = center.y;
    for (var x = center.x; x >= 0; x -= 1){

        var i = id(width, x, y);
        if (data[i] == 255){

            break;
        }

    }
    console.log('found left edge at x = ', x, data[id(width, x, y)])
    addMarker(data, width, height, {
        x: x,
        y: y,
    }, 50)

    
    
    function getCorner(nextConsiderations){
        var averageDirection = {
            x: 0,
            y: 0
        }
        var totalDot = 0;
        var traceDistance = 0;
        var foundCorner = false;
        var minimunTraceSteps = 50;
        console.log('looking for corner', foundCorner, nextConsiderations)
        function getNext(){
            for (var n = 0 ; n < nextConsiderations.length; n += 1){
                var consideration = nextConsiderations[n];
                var d = originalData[id(width, x + consideration.x, y + consideration.y)];
                
                var isRed = d == 255;
                if (isRed == true && foundCorner == false){
                    x += consideration.x;
                    y += consideration.y;

                    averageDirection.x += consideration.x;
                    averageDirection.y += consideration.y;

                    traceDistance += 1;
                    var avgX = averageDirection.x / traceDistance;
                    var avgY = averageDirection.y / traceDistance;
                    var conX = consideration.x / (Math.sqrt(Math.abs(consideration.x) + Math.abs(consideration.y)))
                    var conY = consideration.y / (Math.sqrt(Math.abs(consideration.x) + Math.abs(consideration.y)))
                    var dot = (avgX * conX) + (avgY * conY);
                    // var thresh = Math.min(100, Math.max(.05, 50 / traceDistance));
                    totalDot += dot;
                    var avgDot = totalDot / traceDistance
                    if (traceDistance > minimunTraceSteps && dot < avgDot*.5){
                        foundCorner = true;
                        x -= consideration.x;
                        y -= consideration.y;
                        console.log('found corner!', x, y)
                        corners.push({
                            x: x,
                            y: y
                        })
                    }
                    
                    // var slope = consideration.y / consideration.x;
                    // console.log('status', dot, avgDot)
                    break;
                }
            }
        }



        for (var q = 0 ; q < width*height ; q += 1){
            if (foundCorner == false) {

                getNext();
            }
            else {
                break;
            }
        }
        addMarker(data, width, height, {
            x: x,
            y: y,
        }, 50, [0, 255, 0])

    }

    getCorner([
        {
            x: 1,
            y: 0
        }, {
            x: 1,
            y: -1
        }, {
            x: 0,
            y: -1
        }, {
            x: -1,
            y: -1
        }, {
            x: -1,
            y: 0
        }, {
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 1
        }
    ]);

    getCorner([
        {
            y: 1,
            x: 0
        }, {
            y: 1,
            x: 1
        }, {
            x: 1,
            y: 0
        }, {
            x: 1,
            y: -1
        }, {
            x: 0,
            y: -1
        }, {
            x: -1,
            y: -1
        }, {
            x: -1,
            y: 0
        }
    ]);

    getCorner([
        {
            y: 0,
            x: -1
        }, {
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 1
        }, {
            x: 1,
            y: 1
        }, {
            x: 1,
            y: 0
        }, {
            x: 1,
            y: -1
        }, {
            x: 0,
            y: -1
        }
    ]);

    getCorner([
        {
            x: 0,
            y: -1
        }, {
            x: -1,
            y: -1
        }, {
            x: -1,
            y: 0
        }, {
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 1
        }, {
            x: 1,
            y: 1
        }, {
            x: 1,
            y: 0
        }
    ])
    // need to start tracing in the upwards direction

    var outputImage = new PNG({
            width: width,
            height: height,
            filterType: 4
        })
    outputImage.data = data
    outputImage.pack().pipe(fs.createWriteStream(traceName))
    
    return corners;
    // for (var y = 0 ; y < height ; y += 1){
    //     for (var x = 0; x < width ; x += 1){
    //         var i = id(width, x, y);

    //     }
    // }
}

function superRed(originalData, width, height){
    var maxRed = 0;
    var threshold = .01;
    var data = originalData.map(function(x){return x;})
    for (var y = 0 ; y < height ; y += 1){
        for (var x = 0; x < width ; x += 1){
            var i = id(width, x, y);
            data[i + 1] = 0;
            data[i + 2] = 0;
            if (data[i] > maxRed){
                maxRed = data[i];
            }
        }
    }

    var minRedAllowed = maxRed * ( 1 - threshold);
    for (var y = 0 ; y < height ; y += 1){
        for (var x = 0; x < width ; x += 1){
            var i = id(width, x, y);
            var r = data[i];
            if (r >= minRedAllowed) {
                data[i] = 255;
            } else {
                data[i] = 0;
            }
        }
    }

    return data;
}

function addMarker(originalData, width, height, coord, radius, color){

    if (color == undefined){
        color = [0, 255, 255];
    }
    var rootRadius = Math.sqrt(radius);
    for (var x = coord.x - radius/2; x < coord.x + radius/2 ; x += 1){
        for (var y = coord.y - radius/2; y < coord.y + radius/2; y += 1){
            var i = id(width, x, y);
            var dist = Math.sqrt( Math.pow( coord.x - x , 2) + Math.pow( coord.y - y, 2));
            
            if (dist <= rootRadius){
                originalData[i] = color[0]
                originalData[i + 1] = color[1]
                originalData[i + 2] = color[2]
            }
        }
    }

}
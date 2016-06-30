// Global config
var SIDEBAR_THRESHOLD = 280;

// Global vars
var pymChild = null;
var isMobile = false;
var isSidebar = false;

/*
 * Initialize graphic
 */
var onWindowLoaded = function() {
    if (Modernizr.svg) {
        formatData();

        pymChild = new pym.Child({
            renderCallback: render
        });
    } else {
        pymChild = new pym.Child({});
    }
}

/*
 * Format graphic data for processing by D3.
 */
var formatData = function() {
    DATA = AIRTABLE_DATA['records'];

    DATA = d3.nest()
        .key(function(d) {
            return d['fields']['Cell type'];
            // return d['fields']['Cell category'];
        })
        .sortValues(function(a,b) {
            return cmp(a['fields']['Date'],b['fields']['Date']) ||
                cmp(+a['fields']['Efficiency (%)'],+b['fields']['Efficiency (%)'])
        })
        .entries(DATA);

    DATA.forEach(function(d) {
        var cellData = AIRTABLE_DATA['cell-types'].find(function(name) {
            return name.id === d.key;
        })['fields'];

        var cellCategory = AIRTABLE_DATA['cell-categories'].find(function(name) {
                console.log(name);
                return name.id === cellData['Category'][0];
            })['fields']['Name'];

        // var cellCategory = AIRTABLE_DATA['cell-categories'].find(function(name) {
        //         console.log(name);
        //         return name.id === d.key;
        //     })['fields']['Name'];

        d['start'] = d3.min(d['values'], function(v)  {
            return v['fields']['Efficiency (%)'];
        });
        d['end'] = d3.max(d['values'], function(v)  {
            return v['fields']['Efficiency (%)'];
        });
        // d['label'] = cellCategory + ' - ' + cellData['Cell type'];
        d['label'] = cellData['Cell type'];
        d['category'] = cellCategory;
        // d['label'] = cellCategory;
    });

    console.log(DATA);
}

/*
 * Render the graphic(s). Called by pym with the container width.
 */
var render = function(containerWidth) {
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    if (containerWidth <= SIDEBAR_THRESHOLD) {
        isSidebar = true;
    } else {
        isSidebar = false;
    }

    // Render the chart!
    renderSlopegraph({
        container: '#slopegraph',
        width: containerWidth,
        data: DATA,
        labels: LABELS
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}

/*
 * Render a line chart.
 */
var renderSlopegraph = function(config) {
    /*
     * Setup
     */
    var labelColumn = 'label';
    var startColumn = 'start';
    var endColumn = 'end';
    var categoryColumn = 'category';

    // var startLabel = config['labels']['start_label'];
    // var endLabel = config['labels']['end_label'];
    var startLabel = d3.min(config['data'], function(series) {
        var minDate = d3.min(series['values'], function(d) {
            console.log(d);
            return d['fields']['Date'];
        });

        return '20' + minDate.slice(-2);
    })
    var endLabel = d3.max(config['data'], function(series) {
        var minDate = d3.max(series['values'], function(d) {
            console.log(d);
            return d['fields']['Date'];
        });

        return '20' + minDate.slice(-2);
    })

    var aspectWidth = 5;
    var aspectHeight = 3;

    var margins = {
        top: 20,
        right: 185,
        bottom: 20,
        left: 40
    };

    var ticksX = 2;
    var ticksY = 10;
    var roundTicksFactor = 4;
    var dotRadius = 3;
    var labelGap = 42;

    // Mobile
    if (isSidebar) {
        aspectWidth = 2;
        aspectHeight = 3;
        margins['left'] = 30;
        margins['right'] = 105;
        labelGap = 32;
    } else if (isMobile) {
        aspectWidth = 2.5
        aspectHeight = 3;
        margins['right'] = 145;
    }

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = Math.ceil((config['width'] * aspectHeight) / aspectWidth) - margins['top'] - margins['bottom'];

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    /*
     * Create D3 scale objects.
     */
    var xScale = d3.scale.ordinal()
        .domain([startLabel, endLabel])
        .range([0, chartWidth])

    var min = d3.min(config['data'], function(d) {
        var rowMin = d3.min([d[startColumn], d[endColumn]]);
        return Math.floor(rowMin / roundTicksFactor) * roundTicksFactor;
    });

    var max = d3.max(config['data'], function(d) {
        var rowMax = d3.max([d[startColumn], d[endColumn]]);
        return Math.ceil(rowMax / roundTicksFactor) * roundTicksFactor;
    });

    var yScale = d3.scale.linear()
        .domain([min, max])
        .range([chartHeight, 0]);

    var colorScale = d3.scale.ordinal()
        .domain(_.pluck(config['data'], categoryColumn))
        .range([ COLORS['red3'], COLORS['yellow3'], COLORS['blue3'], COLORS['orange3'], COLORS['teal3'] ]);

    /*
     * Create D3 axes.
     */
    var xAxisTop = d3.svg.axis()
        .scale(xScale)
        .orient('top')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d;
        });

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d;
        });

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom'])
        .append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    /*
     * Render axes to chart.
     */
     chartElement.append('g')
         .attr('class', 'x axis')
         .call(xAxisTop);

    chartElement.append('g')
        .attr('class', 'x axis')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxis);

    /*
     * Render lines to chart.
     */
    var slopes = chartElement.append('g')
        .attr('class', 'slopes')
        .selectAll('.slope')
        .data(config['data'])
        .enter()
        .append('g')
            .attr('class', 'slope' )
            .style('opacity', function(d) {
                return changeScale(d[changeColumn]);
            });

    slopes.append('line')
        .attr('class', function(d, i) {
            return 'line ' + classify(d[labelColumn]);
        })
        .attr('x1', xScale(startLabel))
        .attr('y1', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('x2', xScale(endLabel))
        .attr('y2', function(d) {
            return yScale(d[endColumn]);
        })
        .style('stroke', function(d) {
            return colorScale(d[categoryColumn])
        });

    /*
     * Uncomment if needed:
     * Move a particular line to the front of the stack
     */
    // svg.select('line.unaffiliated').moveToFront();


    /*
     * Render dots to chart.
     */
    slopes.append('circle')
        .attr('cx', xScale(startLabel))
        .attr('cy', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('class', function(d) {
            return 'start ' + classify(d[labelColumn]);
        })
        .attr('r', dotRadius)
        .style('fill', function(d) {
            return colorScale(d[categoryColumn])
        });

    slopes.append('circle')
        .attr('cx', xScale(endLabel))
        .attr('cy', function(d) {
            return yScale(d[endColumn]);
        })
        .attr('class', function(d) {
            return 'end ' + classify(d[labelColumn]);
        })
        .attr('r', dotRadius)
        .style('fill', function(d) {
            return colorScale(d[categoryColumn])
        });

    var hovered = false;

    slopes.on('mouseover', function() {
        var el = d3.select(this);
        var d = el.datum();

        el
            .style('opacity', 1);

        if (d[changeColumn] > 5) { 
            return;
        }
        if (hovered === true) {
            filteredData.pop(d3.select(this).datum());
            renderLabels();
        }

        filteredData.push(d);
        renderLabels();
        // console.log(filteredData.length);

        hovered = true;
    });

    slopes.on('mouseout', function() {
        var el = d3.select(this);
        var d = el.datum();

        el
            .style('opacity', function(d) {
                return changeScale(d[changeColumn]);
            });

        if (d[changeColumn] > 5) { 
            return;
        }
        if (hovered === true) {
            filteredData.pop(d3.select(this).datum());
            renderLabels();
            // console.log(filteredData.length);
        }
        hovered = false;
    })

    var startValueGroup = chartElement.append('g')
        .attr('class', 'value start')
    var endValueGroup = chartElement.append('g')
        .attr('class', 'value end')
    var labelGroup = chartElement.append('g')
        .attr('class', 'label')

    function renderLabels() {
        /*
         * Render values.
         */
        var startValueLabels = startValueGroup
            .selectAll('text')
            .data(filteredData);

        startValueLabels.enter()
            .append('text');

        startValueLabels
            .attr('x', xScale(startLabel))
            .attr('y', function(d) {
                return yScale(d[startColumn]);
            })
            .attr('text-anchor', 'end')
            .attr('dx', -6)
            .attr('dy', 3)
            .attr('class', function(d) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                if (isSidebar) {
                    return d[startColumn].toFixed(0) + '%';
                }

                return d[startColumn].toFixed(1) + '%';
            });

        startValueLabels.exit().remove();

        var endValueLabels = endValueGroup
            .selectAll('text')
            .data(filteredData);

        endValueLabels.enter()
            .append('text');

        endValueLabels    
            .attr('x', xScale(endLabel))
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('text-anchor', 'begin')
            .attr('dx', 6)
            .attr('dy', 3)
            .attr('class', function(d) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                if (isSidebar) {
                    return d[endColumn].toFixed(0) + '%';
                }

                return d[endColumn].toFixed(1) + '%';
            });

        endValueLabels.exit().remove();

        /*
         * Render labels.
         */
        var textLabels = labelGroup
            .selectAll('text')
            .data(filteredData);

        textLabels.enter()
            .append('text');

        textLabels
            .attr('x', xScale(endLabel))
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('text-anchor', 'begin')
            .attr('dx', function(d) {
                return labelGap;
            })
            .attr('dy', function(d) {
                return 3;
            })
            .attr('class', function(d, i) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                return d[labelColumn];
            });
            // .call(wrapText, (margins['right'] - labelGap), 16);

        textLabels.exit().remove();

        // Function for repositioning overlapping labels
        var alpha = 0.5; // how much to move labels in each iteration
        var spacing = 14; // miminum space required

        function relax(items) {
            again = false;
            items.each(function (d, i) {
                var a = this;
                var da = d3.select(a);
                var y1 = da.attr("y");
                items.each(function (d, j) {
                    b = this;
                    // a & b are the same element and don't collide.
                    if (a == b) return;
                    db = d3.select(b);
                    // Now let's calculate the distance between
                    // these elements.
                    y2 = db.attr("y");
                    deltaY = y1 - y2;

                    // Our spacing is greater than our specified spacing,
                    // so they don't collide.
                    if (Math.abs(deltaY) > spacing) return;

                    // If the labels collide, we'll push each
                    // of the two labels up and down a little bit.
                    again = true;
                    sign = deltaY > 0 ? 1 : -1;
                    adjust = sign * alpha;
                    da.attr("y",+y1 + adjust);
                    db.attr("y",+y2 - adjust);
                });
            });
            // Adjust our line leaders here
            // so that they follow the labels.
            if(again) {
                // labelElements = textLabels[0];
                // textLines.attr("y2",function(d,i) {
                //     labelForLine = d3.select(labelElements[i]);
                //     return labelForLine.attr("y");
                // });
                setTimeout(relax(items),20)
            }
        }

        relax(startValueLabels);
        relax(endValueLabels);
        relax(textLabels);
    }

    renderLabels();

}

/*
 * Wrap a block of text to a given width
 * via http://bl.ocks.org/mbostock/7555321
 */
var wrapText = function(texts, width, lineHeight) {
    texts.each(function() {
        var text = d3.select(this);
        var words = text.text().split(/\s+/).reverse();

        var word = null;
        var line = [];
        var lineNumber = 0;

        var x = text.attr('x');
        var y = text.attr('y');

        var dx = parseFloat(text.attr('dx'));
        var dy = parseFloat(text.attr('dy'));

        var tspan = text.text(null)
            .append('tspan')
            .attr('x', x)
            .attr('y', y)
            .attr('dx', dx + 'px')
            .attr('dy', dy + 'px');

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(' '));

            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(' '));
                line = [word];

                lineNumber += 1;

                tspan = text.append('tspan')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('dx', dx + 'px')
                    .attr('dy', lineNumber * lineHeight)
                    .attr('text-anchor', 'begin')
                    .text(word);
            }
        }
    });
}

/*
 * Select an element and move it to the front of the stack
 */
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;

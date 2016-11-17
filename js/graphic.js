// Global vars
/* globals AIRTABLE_DATA:true */
/* globals DATA:true */
/* globals LABELS:true */
/* globals DEFAULT_WIDTH:true */
/* globals MOBILE_THRESHOLD:true */
/* globals COLORS:true */
/* globals fmtComma, fmtYearAbbrev, fmtYearFull */
/* globals classify, formatStyle, makeTranslate, getParameterByName, urlToLocation, cmp, capitalizeFirstLetter */


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
};

/*
 * Format graphic data for processing by D3.
 */
var formatData = function() {
    DATA = AIRTABLE_DATA['cell-types'];

    DATA.forEach(function(d) {
        var cellData = d['fields'];

        var cellCategory = cellData['Category lookup'][0];

        d['start'] = cellData['Min lab efficiency'];
        d['end'] = cellData['Record lab efficiency'];
        d['maxYear'] = cellData['Record lab date'];
        d['minYear'] = cellData['Min lab date'];
        d['change'] = d['end'] - d['start'];
        d['fullName'] = cellCategory + ' - ' + cellData['Cell type'];
        d['label'] = cellData['Cell type'];
        d['category'] = cellCategory;
        d['description'] = cellData['Technology overview'];
        d['pros'] = cellData['Advantages'];
        d['cons'] = cellData['Limitations'];

        if (d['pros']) {

            d['pros'] = d['pros'].trim()
                .replace(/\s*;\s*$/, '')
                .split('; ')
                .map(function(pro) {
                    return capitalizeFirstLetter(pro);
                });
        }

        if (d['cons']) {

            d['cons'] = d['cons'].trim()
                .replace(/\s*;\s*$/, '')
                .split('; ')
                .map(function(pro) {
                    return capitalizeFirstLetter(pro);
                });
        }
    });
};

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
    renderDotChart({
        container: '#dot-chart',
        width: containerWidth,
        data: d3.nest()
            .key(function(d) {
                return d['category'];
            })
            .sortValues(function(a, b) {
                return b['end'] - a['end'];
            })
            .entries(DATA)
            .map(function(d) {
                return d.values;
            })
            .sort(function(a, b) {
                return d3.max(b, function(d) { return d['end']; }) - d3.max(a, function(d) { return d['end']; });
            })
    });

    // Render the chart!
    renderSlopegraph({
        container: '#slopegraph',
        width: containerWidth,
        data: DATA.sort(function(a,b) {
            return b.end - a.end;
        }),
        labels: LABELS
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
};

/*
 * Render a dot chart.
 */
var renderDotChart = function(config) {
    /*
     * Setup
     */
    var labelColumn = 'category';
    var valueColumn = 'end';
    var minColumn = 'start';
    var maxColumn = 'end';

    var barHeight = 20;
    var barGap = 20;
    var labelWidth = 140;
    var labelMargin = 10;
    var valueMinWidth = 30;
    var dotRadius = 5;
    var strokeWidth = 1;
    var outerDiameter = (dotRadius + strokeWidth) * 2;

    var margins = {
        top: 0,
        right: 15,
        bottom: 20,
        left: (labelMargin)
    };

    var ticksX = 4;
    var roundTicksFactor = 5;

    if (isMobile) {
        ticksX = 6;
        margins['left'] = labelMargin * 2;
        dotRadius = 10;
        outerDiameter = (dotRadius + strokeWidth) * 2;
        // margins['right'] = 30;
    }
    // console.log(config.data);

    // console.log(config['data'].reduce(function(a,b) {return a.length + b.length; }, 0));

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = ((outerDiameter) * config['data'].reduce(function(a,b) {
        return a + b.length;
    }, 0)) + (config['data'].length * barGap);

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');
    containerElement.classed('mobile', isMobile);

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
     * Create D3 scale objects.
     */
    var min = 0;
    var max = d3.max(config['data'], function(d) {
        var catMax = d3.max(d, function(d) { return d[maxColumn]; });
        return Math.ceil(catMax / roundTicksFactor) * roundTicksFactor;
    });

    var xScale = d3.scale.linear()
        .domain([min, max])
        .range([0, chartWidth]);

    // console.log(_.map(config['data'], function(d) { console.log(d); return d[0].labelColumn; }));
    var colorScale = d3.scale.ordinal()
        .domain(_.map(config['data'], function(d) {
            return d[0][labelColumn];
        })
        .sort(function(a,b) {
            return a.localeCompare(b);
        }))
        .range([COLORS['orange'], COLORS['dark red'], COLORS['light blue'], COLORS['teal'], COLORS['dark green']]);

    /*
     * Render the HTML legend.
     */
    d3.select('#dot-legend').html('');
    var legend = d3.select('#dot-legend')
        .attr('class', 'key')
        .selectAll('g')
        // .data(config['data'])
        // .data(colorScale.domain())
        .data(['concentrator','non-concentrator'])
        .enter().append('li')
            .attr('class', function(d, i) {
                return 'key-item ' + classify(d);
            });

    legend.append('b')
        .style('background-color', function(d) {
            return d === 'non-concentrator' ? COLORS['white'] : COLORS['black'];
        })
        .style('border-color', function(d) {
            return COLORS['black'];
        });

    legend.append('label')
        .text(function(d) {
            return d;
        });

    /*
     * Create D3 axes.
     */
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d + '%';
        });

    /*
     * Render axes to chart.
     */
    chartElement.append('g')
        .attr('class', 'x axis')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxis);

    /*
     * Render grid to chart.
     */
    var xAxisGrid = function() {
        return xAxis;
    };

    chartElement.append('g')
        .attr('class', 'x grid')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxisGrid()
            .tickSize(-chartHeight, 0, 0)
            .tickFormat('')
        );

    /*
     * Render range bars to chart.
     */
    // chartElement.append('g')
    //     .attr('class', 'bars')
    //     .selectAll('line')
    //     .data(config['data'])
    //     .enter()
    //     .append('line')
    //         .attr('x1', function(d, i) {
    //             return xScale(d[minColumn]);
    //         })
    //         .attr('x2', function(d, i) {
    //             return xScale(d[maxColumn]);
    //         })
    //         .attr('y1', function(d, i) {
    //             return i * (barHeight + barGap) + (barHeight / 2);
    //         })
    //         .attr('y2', function(d, i) {
    //             return i * (barHeight + barGap) + (barHeight / 2);
    //         });

    /*
     * Render dots to chart.
     */
    var dotGroups = chartElement
        .selectAll('.dots')
        .data(config['data'])
        .enter().append('g')
        .attr('class', 'dots')
        .attr('transform', function(d, i) {
            return makeTranslate(0, (config['data'].slice(0, i).reduce(function(a,b) {
                return a + b.length;
            }, 0) * outerDiameter) + ((i + 1) * barGap));
        });

    var dots = dotGroups.selectAll('circle')
        .data(function(d) { return d; })
        .enter().append('circle')
            .classed('dot', true)
            .attr('pointer-events', 'visible')
            .attr('cx', function(d, i) {
                // console.log(d);
                // console.log(d[valueColumn]);
                return xScale(d[valueColumn]);
            })
            .attr('cy', function(d, i) {
                return (i * outerDiameter) + dotRadius;
            })
            .attr('r', dotRadius)
            .style('fill', 'none')
            .style('stroke', function(d) {
                return colorScale(d[labelColumn]);
            })
            .style('stroke-width', strokeWidth + 'px');

    dots.filter(function(d) {
            return d['fields']['Concentrator'];
        })
        .style('fill', function(d) {
            // console.log(colorScale.domain());
            return colorScale(d[labelColumn]);
        });

    /*
     * Render bar labels.
     */
    containerElement
        .append('ul')
        .attr('class', 'labels')
        .attr('style', formatStyle({
            'width': labelWidth + 'px',
            'top': margins['top'] + 'px',
            'left': '0'
        }))
        .selectAll('li')
        .data(config['data'])
        .enter()
        .append('li')
            .attr('style', function(d, i) {
                return formatStyle({
                    'width': labelWidth + 'px',
                    'height': barHeight + 'px',
                    'left': '0px',
                    'top': (config['data'].slice(0, i).reduce(function(a,b) {
                        return a + b.length;
                    }, 0) * outerDiameter) + ((i + 1) * barGap) + ((d.length - 1) * dotRadius) - 2 + 'px;',
                    'margin-left': isMobile ? 0 : margins['left'] + 'px'
                });
            })
            .attr('class', function(d) {
                return classify(d[0][labelColumn]);
            })
            .append('span')
                .text(function(d) {
                    return d[0][labelColumn];
                })
                .style('border-color', function(d) {
                    return colorScale(d[0][labelColumn]);
                });

    var ttTemplate = _.template(d3.select('#tooltip-template').html(), {variable: 'record'});
    var tooltip = chartWrapper.append('div')
            .classed('tooltip-details', true);

    d3.select(chartElement.node().parentElement).on('click', function(){
        tooltip.style('display', 'none');
    });

    dots.on('mouseover', function() {
        var el = d3.select(this);
        var selectedData = el.datum();
        var offset = 15;
        // var dateFormat = d3.time.format('%b %Y');

        if (isMobile) {
            return;
        }

        d3.selectAll('.tooltip')
            .remove();

        dots
            .attr('r', dotRadius);

        el
            .attr('r', dotRadius * 1.5 );

        var ttText = d3.select(el.node().parentNode).append('g')
            .attr('class', 'tooltip')
            .append('text')
                // .attr('filter', 'url(#solid)')
                .attr('text-anchor', function() {
                    return xScale(selectedData[valueColumn]) > (chartWidth / 2) ? 'end' : 'start';
                })
                .attr('dx', function() {
                    return xScale(selectedData[valueColumn]) > (chartWidth / 2) ? (- offset) : offset;
                })
                .attr('dy', 3)
                .attr('x', this.getAttribute('cx'))
                .attr('y', this.getAttribute('cy'))
                .text(selectedData['label']);

        var bbox = ttText.node().getBBox();
        var padding = {w:3, h:1};
        var rect = d3.select('.tooltip').insert('rect', 'text')
            .attr('class', 'tt-background')
            .attr('x', bbox.x - padding.w)
            .attr('y', bbox.y - padding.h)
            .attr('width', bbox.width + (padding.w*2))
            .attr('height', bbox.height + (padding.h*2))
            .style('fill', 'white')
            .style('stroke', '#ddd')
            .style('width', (bbox.width + (padding.w*2)) + 'px')
            .style('height', (bbox.height + (padding.h*2)) + 'px');
    });

    dots.on('mouseout', function() {

    });

    dots.on('click', function() {
        d3.event.stopPropagation();

        var node = this;
        var selectedData = d3.select(this).datum();
        // console.log(selectedData);
        var ttWidth = chartWidth;
        var svgPos = chartElement.node().parentElement.getBoundingClientRect();
        var matrix = node.getScreenCTM()
            .translate(+ node.getAttribute('x') - svgPos.left, + node.getAttribute('y') + node.getAttribute('cy') - svgPos.top);

        tooltip
            .html(ttTemplate(selectedData))
            .classed('split', !isMobile)
            .style('max-width', ttWidth + 'px')
            .style('left', function() {
                return (window.pageXOffset + matrix.e) + 'px';
            })
            .style('top', function() {
                return (window.pageYOffset + matrix.f + dotRadius) + 'px';
            })
            .style('width', (chartWidth - 20) + 'px')
            .style('display', 'block');

        // tooltip
        //     .select('#select-series').selectAll('option')
        //     .data(config['data'])
        // .enter()
        //     .append('option')
        //     .attr('value', function (d) { return d.name; })
        //     .text(function (d) { return d.name; });

        tooltip.select('#close').on('click', function() {
            d3.event.preventDefault();
            tooltip.style('display', 'none');
        });

        pymChild.sendHeight();
    });
};

/*
 * Render a line chart.
 */
var renderSlopegraph = function(config) {
    /*
     * Setup
     */
    var labelColumn = 'fullName';
    var startColumn = 'start';
    var endColumn = 'end';
    var categoryColumn = 'category';
    var changeColumn = 'change';
    var fullName = 'fullName';
    // var filteredData = config['data'].filter(function(d) { return d[changeColumn] > 5; });

    var startLabel = d3.min(config['data'], function(series) {
        var minYear = series['minYear'].slice(2,4);
        if ( !minYear ) { return; }
        // console.log(minYear);
        if( +minYear >= 69) {
            minYear = +('19' + minYear);
            // console.log(minYear);
            // return minYear;
            return;
        }
        else {
            minYear = +('20' + minYear);
            // console.log(minYear);
            return minYear;
        } 
    });
    var endLabel = d3.max(config['data'], function(series) {
        var maxYear = series['maxYear'].slice(2,4);
        if ( !maxYear ) { return; }
        if( +maxYear >= 69) {
            maxYear = +('19' + maxYear);
            // console.log(maxYear);
            return maxYear;
        }
        else {
            maxYear = +('20' + maxYear);
            // console.log(maxYear);
            return maxYear;
        } 
    });

    var aspectWidth = 5;
    var aspectHeight = 4;

    var margins = {
        top: 20,
        right: 240,
        bottom: 20,
        left: 45
    };

    var ticksX = 2;
    var ticksY = 10;
    var roundTicksFactor = 4;
    var dotRadius = 3;
    var labelGap = 82;
    var connector = 5;

    // Mobile
    if (isSidebar) {
        aspectWidth = 2;
        aspectHeight = 3;
        margins['left'] = 30;
        margins['right'] = 105;
        labelGap = 32;
    } else if (isMobile) {
        aspectWidth = 2.5;
        aspectHeight = 3;
        dotRadius = 4;
        margins['right'] = 160;
        labelGap = 50;
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
    var xScale = d3.scale.linear()
        .domain([startLabel, endLabel])
        .range([0, chartWidth]);

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
        .domain(_.pluck(config['data'], categoryColumn)
            .sort(function(a, b) {
                // console.log(a['name']);
                return a.localeCompare(b);
            })
        )
        .range([COLORS['orange'], COLORS['dark red'], COLORS['light blue'], COLORS['teal'], COLORS['dark green']]);

    var changeScale = d3.scale.linear()
        .domain([0,d3.max(config['data'], function (d) {
            var timeDiff = (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4)));
            if ( timeDiff === 0 ) {
                return 0;
            }
            // console.log(d[changeColumn] / (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4))));
            return d[changeColumn] / (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4)));
        })])
        .range([0.2,1]);

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
     * Render the HTML legend.
     */
    d3.select('#legend').html('');
    var legend = d3.select('#legend')
        .attr('class', 'key')
        .selectAll('g')
        // .data(config['data'])
        // .data(colorScale.domain())
        .data(colorScale.domain().sort(function(a, b) {
            // console.log(a['name']);
            return a.localeCompare(b);
        }))
        .enter().append('li')
            .attr('class', function(d, i) {
                return 'key-item ' + classify(d);
            });

    legend.append('b')
        .style('background-color', function(d) {
            return colorScale(d);
        })
        .style('border-color', function(d) {
            return colorScale(d);
        });

    legend.append('label')
        .text(function(d) {
            return d;
        });

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
            .style('opacity', function (d) {
                var timeDiff = (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4)));
                if ( timeDiff === 0 ) {
                    return changeScale(0);
                }
                // console.log(d[changeColumn] / (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4))));
                return changeScale(d[changeColumn] / (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4))));
            });

    slopes.append('line')
        .attr('class', 'invisible')
        .attr('x1', function(d) {
            var minYear = d['minYear'].slice(2,4);
            if ( !minYear ) { return; }
            // console.log(startLabel);
            if( +minYear >= 69) {
                minYear = +('19' + minYear);
                // console.log(minYear);
                // return minYear;
                return xScale(startLabel);
            }
            else {
                minYear = +('20' + minYear);
                // console.log(minYear);
                return xScale(minYear);
            }
        })
        .attr('y1', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('x2', xScale(endLabel))
        .attr('y2', function(d) {
            return yScale(d[endColumn]);
        })
        .style('stroke', function(d) {
            return colorScale(d[categoryColumn]);
        });

    slopes.append('line')
        .attr('class', 'invisible')
        .attr('x1', xScale(startLabel))
        .attr('y1', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('x2', function(d) {
            var minYear = d['minYear'].slice(2,4);
            if ( !minYear ) { return; }
            // console.log(startLabel);
            if( +minYear >= 69) {
                minYear = +('19' + minYear);
                // console.log(minYear);
                // return minYear;
                return xScale(startLabel);
            }
            else {
                minYear = +('20' + minYear);
                // console.log(minYear);
                return xScale(minYear);
            }
        })
        .attr('y2', function(d) {
            return yScale(d[startColumn]);
        });

    slopes.append('line')
        .attr('class', function(d, i) {
            return 'line ' + classify(d[labelColumn]);
        })
        .attr('x1', function(d) {
            var minYear = d['minYear'].slice(2,4);
            if ( !minYear ) { return; }
            // console.log(startLabel);
            if( +minYear >= 69) {
                minYear = +('19' + minYear);
                // console.log(minYear);
                // return minYear;
                return xScale(startLabel);
            }
            else {
                minYear = +('20' + minYear);
                // console.log(minYear);
                return xScale(minYear);
            }
        })
        .attr('y1', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('x2', xScale(endLabel))
        .attr('y2', function(d) {
            return yScale(d[endColumn]);
        })
        .style('stroke', function(d) {
            return colorScale(d[categoryColumn]);
        });

    slopes.append('line')
        .attr('class', function(d, i) {
            return 'init-line ' + classify(d[labelColumn]);
        })
        .attr('x1', xScale(startLabel))
        .attr('y1', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('x2', function(d) {
            var minYear = d['minYear'].slice(2,4);
            if ( !minYear ) { return; }
            // console.log(startLabel);
            if( +minYear >= 69) {
                minYear = +('19' + minYear);
                // console.log(minYear);
                // return minYear;
                return xScale(startLabel);
            }
            else {
                minYear = +('20' + minYear);
                // console.log(minYear);
                return xScale(minYear);
            }
        })
        .attr('y2', function(d) {
            return yScale(d[startColumn]);
        })
        .style('stroke', function(d) {
            return colorScale(d[categoryColumn]);
        })
        .style('stroke-dasharray', '3, 10');

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
        .attr('class', 'invisible')
        .attr('r', dotRadius * 3)
        .style('fill', function(d) {
            return colorScale(d[categoryColumn]);
        });

    slopes.append('circle')
        .attr('cx', xScale(endLabel))
        .attr('cy', function(d) {
            return yScale(d[endColumn]);
        })
        .attr('class', 'invisible')
        .attr('r', dotRadius * 3)
        .style('fill', function(d) {
            return colorScale(d[categoryColumn]);
        });

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
            return colorScale(d[categoryColumn]);
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
            return colorScale(d[categoryColumn]);
        });

    var hovered = false;

    slopes.on('mouseover', function() {
        var el = d3.select(this);
        var d = el.datum();

        d.hovered = true;

        el
            .style('opacity', 1)
            .classed('hovered', true);

        el.selectAll('circle')
            .attr('r', dotRadius + 1);

        el.moveToFront();

        renderLabels();

        // if (d[changeColumn] > 5) {
        //     renderLabels();
        //     return;
        // }
        // if (hovered === true) {
        //     filteredData.pop(d3.select(this).datum());
        //     renderLabels();
        // }

        // filteredData.push(d);
        // renderLabels();
        // // console.log(filteredData.length);

        // hovered = true;
    });

    slopes.on('mouseout', function() {
        var el = d3.select(this);
        var d = el.datum();

        d.hovered = false;

        el
            .style('opacity', function (d) {
                var timeDiff = (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4)));
                if ( timeDiff === 0 ) {
                    return changeScale(0);
                }
                // console.log(d[changeColumn] / (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4))));
                return changeScale(d[changeColumn] / (xScale(d['maxYear'].slice(2,4)) - xScale(d['minYear'].slice(2,4))));
            })
            .classed('hovered', false);

        el.selectAll('circle')
            .attr('r', dotRadius);

        renderLabels();

        // if (d[changeColumn] > 5) {
        //     renderLabels();
        //     return;
        // }
        // if (hovered === true) {
        //     filteredData.pop(d3.select(this).datum());
        //     renderLabels();
        //     // console.log(filteredData.length);
        // }
        // hovered = false;
    });

    // slopes.on('click', function() {
    //     var el = d3.select(this);
    //     var d = el.datum();

    //     var selectedData = config['data'].filter(function (d) { return d.selected || d.hovered; });

    //     d.selected = d.selected ? false : true;
    // });

    var startValueGroup = chartElement.append('g')
        .attr('class', 'value start');
    var endValueGroup = chartElement.append('g')
        .attr('class', 'value end');
    var labelGroup = chartElement.append('g')
        .attr('class', 'label');
    var connectorsGroup = chartElement.append('g')
        .attr('class', 'connector');

    function renderLabels() {
        var selectedData = config['data'].filter(function (d) { return d.selected || d.hovered; });

        // console.log(selectedData);

        /*
         * Render values.
         */
        var startValueLabels = startValueGroup
            .selectAll('text')
            .data(selectedData, function(d) { return d[fullName]; });

        startValueLabels.enter()
            .append('text');

        startValueLabels.sort(function(a,b) {
                return b['start'] - a['start'];
            });

        startValueLabels
            .attr('x', xScale(startLabel))
            .attr('y', function(d) {
                return yScale(d[startColumn]);
            })
            .attr('text-anchor', 'end')
            .attr('dx', -6 - connector)
            .attr('dy', 3)
            .attr('class', function(d) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                if (isSidebar) {
                    return d[startColumn].toFixed(0) + '%';
                }

                return d[startColumn].toFixed(1) + '%';
            })
            .style('font-weight', function(d) {
                return d.hovered ? 'bold' : 'normal';
            });

        startValueLabels.exit().remove();

        var endValueLabels = endValueGroup
            .selectAll('text')
            .data(selectedData, function(d) { return d[fullName]; });

        endValueLabels.enter()
            .append('text');

        endValueLabels.sort(function(a,b) {
                return b['end'] - a['end'];
            });

        endValueLabels
            .attr('x', xScale(endLabel) + connector)
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
                if (isSidebar  || isMobile) {
                    return d[endColumn].toFixed(1) + '%';
                }

                return d[endColumn].toFixed(1) + '%' + ' (+' + (d[endColumn] - d[startColumn]).toFixed(1)+ ')';
            })
            .style('font-weight', function(d) {
                return d.hovered ? 'bold' : 'normal';
            });

        endValueLabels.exit().remove();

        /*
         * Render labels.
         */
        var textLabels = labelGroup
            .selectAll('text')
            .data(selectedData, function(d) { return d[fullName]; });

        textLabels.enter()
            .append('text')
            .attr('class', function(d, i) {
                return classify(d[labelColumn]);
            })
            .attr('x', xScale(endLabel))
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('text-anchor', 'begin')
            .attr('dx', function(d) {
                return labelGap + (connector * 2);
            })
            .attr('dy', function(d) {
                return 3;
            })
            .text(function(d) {
                return d[labelColumn];
            })
            .call(wrapText, (margins['right'] - labelGap - 15), 12);

        textLabels.sort(function(a,b) {
                return b['end'] - a['end'];
            });

        textLabels
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('dy', function(d) {
                return 3;
            })
            .style('font-weight', function(d) {
                return d.hovered ? 'bold' : 'normal';
            });

        textLabels.selectAll('tspan')
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            });

        textLabels.exit().remove();

        // Function for repositioning overlapping labels
        var alpha = 0.5; // how much to move labels in each iteration
        var spacing = 14; // miminum space required

        function relax(items) {
            var again = false;
            items.each(function (d, i) {
                var a = this;
                var da = d3.select(a);
                var y1 = da.attr('y');
                var daChildren = da.selectAll('tspan');
                var totalSpace;
                if (daChildren.size() > 0) {
                    totalSpace = daChildren.size() * spacing;
                }
                else {
                    totalSpace = spacing;
                }

                items.each(function (d, j) {
                    var b = this;
                    // a & b are the same element and don't collide.
                    if (a == b) return;
                    var db = d3.select(b);
                    var dbChildren = db.selectAll('tspan');
                    // Now let's calculate the distance between
                    // these elements.
                    var y2 = db.attr('y');
                    var deltaY = y1 - y2;

                    if (deltaY > 0 && dbChildren.size() > 0) {
                        totalSpace = dbChildren.size() * spacing;
                    }

                    // Our spacing is greater than our specified spacing,
                    // so they don't collide.
                    if ( Math.abs(deltaY) > totalSpace ) return;

                    // If the labels collide, we'll push each
                    // of the two labels up and down a little bit.
                    again = true;
                    var sign = deltaY > 0 ? 1 : -1;
                    var adjust = sign * alpha;
                    da.attr('y',+y1 + adjust);
                    db.attr('y',+y2 - adjust);
                    daChildren.attr('y',+y1 + adjust);
                    dbChildren.attr('y',+y2 - adjust);
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
                setTimeout(relax(items),20);
            }
        }

        relax(startValueLabels);
        relax(endValueLabels);
        relax(textLabels);


        var startValueConnectors = connectorsGroup
            .selectAll('line.start-label-connector')
            .data(selectedData, function(d) { return d[fullName]; });

        startValueConnectors.enter()
            .append('line')
            .classed('start-label-connector', true);

        startValueConnectors.sort(function(a,b) {
                return b['start'] - a['start'];
            });

        startValueConnectors
            .attr('x1', xScale(startLabel) - dotRadius)
            .attr('x2', xScale(startLabel) - connector - dotRadius)
            .attr('y1', function(d) {
                return yScale(d[startColumn]);
            })
            .attr('y2', function(d, i) {
                return d3.select(startValueLabels[0][i]).attr('y');
            });

        startValueConnectors.exit().remove();

        var endValueConnectors = connectorsGroup
            .selectAll('line.end-label-connector')
            .data(selectedData, function(d) { return d[fullName]; });

        endValueConnectors.enter()
            .append('line')
            .classed('end-label-connector', true);

        endValueConnectors.sort(function(a,b) {
                return b['end'] - a['end'];
            });

        endValueConnectors
            .attr('x1', xScale(endLabel) + dotRadius)
            .attr('x2', xScale(endLabel) + connector + dotRadius)
            .attr('y1', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('y2', function(d, i) {
                return d3.select(endValueLabels[0][i]).attr('y');
            });

        endValueConnectors.exit().remove();

        var labelConnectors = connectorsGroup
            .selectAll('line.label-connector')
            .data(selectedData, function(d) { return d[fullName]; });

        labelConnectors.enter()
            .append('line')
            .classed('label-connector', true);

        labelConnectors.sort(function(a,b) {
                return b['end'] - a['end'];
            });

        labelConnectors
            .attr('x1', xScale(endLabel) + labelGap - connector)
            .attr('x2', xScale(endLabel) + connector + labelGap)
            .attr('y1', function(d, i) {
                return d3.select(endValueLabels[0][i]).attr('y');
            })
            .attr('y2', function(d, i) {
                return d3.select(textLabels[0][i]).attr('y');
            });

        labelConnectors.exit().remove();


    }

    config['data'].filter(function (d) { return d[changeColumn] > 7; }).forEach(function(d) {
        d.selected = true;
    });

    renderLabels();

};

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

        while ( (word = words.pop()) ) {
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
                    .attr('dy', (dy + (lineNumber * lineHeight)) + 'px')
                    .attr('text-anchor', 'begin')
                    .text(word);
            }
        }
    });
};

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

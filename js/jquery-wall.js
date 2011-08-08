(function ($) {
    
  $.fn.wall = function(options) { 
        
        return this.each(function() {
        
            var defaults = {
                
                // dimensions and styles
                'width': 1024, // width of the wall
                'height': 768, // height of the wall
                'sizes': [
                    { 'dim': 130, 'suff': '_jpg_o', 'name': 'Small images' },
                    { 'dim': 177, 'suff': '_jpg_ws', 'name': 'Medium images' },
                    { 'dim': 265, 'suff': '_jpg_w', 'name': 'Large images' },
                    { 'dim': 355, 'suff': '_jpg_ds', 'name': 'X-Large images' }
                ],
                'start_size': 2,
                'tile_margin': 8, // margin around each tile
                'sidebar_image_size': 265, // size of the image in the sidebar panel
                'background_color': '#ffffff', // background colour of the whole wall
                'tile_border_color': '#a1a1a1', // colour of tile borders
                'img_fadein': 500, // how long each image should take to fade in (ms)
                'fullscreen_speed': 250, // how long the wall should take to resize (ms)
                'search_box_default': 'New search', // initial text in the search box
                'min_category_count': 30, // minimum number of objects a category must have to be displayed in the sidebar panel (because, say 10 objects don't make a good wall)
                'browse_prompt': '<strong>Tags:</strong>', // text to prompt user to click categories
                'padding': 8, // amount of padding to add to elements that require padding
                'wall_border': '1px solid #a1a1a1',
                'panel_width': 'auto',
                'hide_loader_time': 2000, // how long to display the loading dialog after the images are all loaded
                
                // messaging
                'alert_title': 'Oops',
                'alert_msg_no_images': 'Sorry, there are not enough images for that search to fill the screen.',
                'alert_msg_enter_search': 'Please enter a search term and try again.',
                'alert_msg_zoom_max': 'Sorry, cannot zoom in any further.',
                'alert_msg_zoom_min': 'Sorry, cannot zoom out any further.',
                'tips': [
                    'Try dragging the image grid to reveal more images.',
                    'You can change the size of the tiles using the zoom buttons in the panel below.',
                    'You can shuffle the images using the button in the panel below.',
                    'Try switching to full screen and back using the toggle fullscreen button.',
                    'Click on an image to reveal the sidebar with more information about the object.',
                    'You can load images from a category by clicking the category names in the sidebar.',
                    'You can drag this window.',
                    'You can search for similar objects by clicking the object name in the sidebar.',
                    'The search returns a maximum of 1000 objects.'
                ],
                
                // api stuff
                'api_stub': 'http://www.vam.ac.uk/api/json/museumobject/',
                'api_search_path': 'search',
                'images_url': 'http://media.vam.ac.uk/media/thira/collection_images/',
                'collections_record_url': 'http://collections.vam.ac.uk/item/',
                'search_term': '',
                'search_category_name': '',
                'search_category_term': '',
                'search_category_pk': null,
                'max_results': 1000, // the max results we can handle
                'limit': 25, // how many images to get per api request
                'search_term': '', // term to search the api for
                'category-stub': '', // category to retrieve images from 
                'sidebar_image_suffix': '_jpg_w',
                'large_image_suffix': '_jpg_l',
                
                // html fragments
                'blank_tile': '<li><img class="blank" src="" alt="" offset="0" title="" /></li>',
                
                // nuts and bolts
                'cache_interval': 50, // how often to cache some images (ms)
                'fill_interval': 25, // how often to fill tiles from cache (ms)
                
                // list of taxonomy terms to populate the sidebar
                'taxonomy': [
                    'styles',
                    'collections',
                    'subjects',
                    'names',
                    'exhibitions',
                    'galleries',
                    'techniques',
                    'materials',
                    'categories',
                    'places'
                ]
                
            };

            var settings = $.extend({}, defaults, options); 

            init($(this), settings);

            function init(wall, settings) {
             
                // we don't want scrollbars
                $("body").css({
                    'overflow': 'hidden'
                })
             
                // sort out some dimensions
                settings.current_size = settings.start_size;
                settings.tile_width = settings.sizes[settings.current_size].dim;
                settings.tile_height = settings.sizes[settings.current_size].dim;
                settings.tile_sidebar_image_suffix = settings.sizes[settings.current_size].suff;
                settings.cell_width = settings.tile_width + settings.tile_margin + 2; // the '2' accounts for borders
                settings.cell_height = settings.tile_height + settings.tile_margin + 2; 
                settings.start_rows = Math.ceil(settings.height / settings.cell_height);
                settings.start_cols = Math.ceil(settings.width / settings.cell_width);
             
                settings.sidebar_width = settings.sidebar_image_size;
             
                // write out an empty grid
                var grid_html = '<div id="grid">';
                    for(i=0; i < settings.start_rows; i++) {
                        grid_html += drawEmptyRow(settings.start_cols);
                    }
                grid_html += '</div>';
                wall.html(grid_html);
                
                // record the starting size and position, so we can go back to it after fullscreen
                settings.start = {
                    'top': wall.position().top,
                    'left': wall.position().left
                }
                settings.fullscreen = false;

                // apply styles to the empty grid
                wall.css({
                    'width': settings.width,
                    'height': settings.height,
                    'background-color': settings.background_color,
                    //~ 'font-family': settings.font_family,
                    //~ 'font-size': settings.font_size,
                    'border': settings.wall_border
                });
                $("#grid", wall).css({
                    'width': settings.cell_width * settings.start_cols
                });
                styleNewTiles(wall);

                // control panel
                var panel   =     '<div id="panel" class="ui-widget ui-widget-content ui-corner-all">';
                panel       +=    '<ul id="icons">';
                panel       +=    '<li><input class="ui-state-default ui-corner-all" type="text" name="search" value="'+settings.search_box_default+'"></li>';
                panel       +=    '<li class="ui-state-default ui-corner-all"><span class="submitsearch ui-icon ui-icon-search" title="Submit search"></span></li>';
                panel       +=    '<li class="ui-state-default ui-corner-all"><span class="fullscreen ui-icon ui-icon-arrow-4-diag" title="Toggle full screen"></span></li>';
                panel       +=    '<li class="ui-state-default ui-corner-all"><span class="shuffle ui-icon ui-icon-shuffle" title="Shuffle images"></span></li>';
                panel       +=    '<li class="ui-state-default ui-corner-all"><span class="zoomin ui-icon ui-icon-zoomin" title="Larger tiles"></span></li>';
                panel       +=    '<li class="ui-state-default ui-corner-all"><span class="zoomout ui-icon ui-icon-zoomout" title="Smaller tiles"></span></li>';
                panel       +=    '</ul>'
                panel       +=    '</div>';
                
                // sidebar
                var sidebar_html =      '<div id="sidebar"  class="ui-dialog ui-widget ui-widget-content ui-corner-all">';
                sidebar_html     +=     '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix"><span class="ui-dialog-title object-title"></span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button"><span class="ui-icon ui-icon-closethick">close</span></a></div>';
                sidebar_html     +=     '<div class="sidebar_image"></div>';
                sidebar_html     +=     '<div class="sidebar_info"></div>';
                sidebar_html     +=     '</div>';
                
                // dialog box
                var dialog      =       '<div id="dialog" class="ui-dialog ui-widget ui-widget-content ui-corner-all">';
                dialog          +=      '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix"><span class="ui-dialog-title">'+settings.alert_title+'</span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button"><span class="ui-icon ui-icon-closethick">close</span></a></div>';
                dialog          +=      '<p><span style="float: left; margin-right: .3em;" class="ui-icon ui-icon-alert"></span><span id="dialog_text"></span></p>';
                dialog          +=      '<div class="ui-dialog-buttonpane ui-widget-content ui-helper-clearfix"><div class="ui-dialog-buttonset"><button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only" role="button" aria-disabled="false"><span class="ui-button-text">Ok</span></button></div></div>';
                dialog          +=      '</div>';
                
                // loading dialog
                var loading     =       '<div id="loading" class="ui-dialog ui-widget ui-widget-content ui-corner-all">';
                loading          += '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix"><span class="ui-dialog-title">Please wait...</span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button"><span class="ui-icon ui-icon-closethick">close</span></a></div>';
                loading         +=      '<p class="results_info"></p>';
                loading         +=      '<div id="progressbar"></div>';
                loading         +=      '</div>';
                
                // fullsize dialog
                var fs          =       '<div id="fullsize" class="ui-dialog ui-widget ui-widget-content ui-corner-all">';
                fs              +=       '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix"><span class="ui-dialog-title"></span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button"><span class="ui-icon ui-icon-closethick">close</span></a></div>';
                fs              +=      '<img src="" alt="" title="" />';
                fs              +=      '</div>';
                
                $("#grid").after(sidebar_html).after(panel).after(dialog).after(loading).after(fs);
                var p = $('#panel');
                p.css({
                    'left': wall.width()/2 - p.width()/2,
                    'bottom': 0
                })
                allow_shuffle = false;
                fullsize_dragged = false;
                cache_full = false;
                
                apiStart(wall, settings);
                
                // initialize the draggable grid
                $('#grid', wall).draggable({
                
                    cursor: 'pointer',
                    delay: 150,
                    stop: function() { 
                        draw($(this.parentNode)); // <== 'this' is the draggable, which is $('#grid'), so its parentNode is the wall div
                    }
                    
                });
                
                $('#loading', wall).draggable({
                    containment: 'parent'
                });

                $('#fullsize', wall).draggable({
                    containment: 'parent',
                    stop: function() {
                        fullsize_dragged = true;
                    }
                });

                $("#icons li span").mouseover(function() {
                    $(this).parent().addClass('ui-state-hover');
                });
                
                $("#icons li span").mouseout(function() {
                    $(this).parent().removeClass('ui-state-hover');
                });
                
                // - fullscreen
                $('#panel span.fullscreen', wall).click(function(event) {
                    event.preventDefault();
                    
                    var sidebar = $("#sidebar", wall);
                    
                    if (settings.fullscreen) {
                        // shrink
                        wall.animate({
                            'width': settings.width,
                            'height': settings.height,
                            'top': settings.start.top,
                            'left': settings.start.left
                        }, settings.fullscreen_speed, function() { 
                            
                            if(sidebar.is(':visible')) {
                                sidebar.animate({
                                    'width': settings.sidebar_width,
                                    'height': wall.height() - 2*settings.padding,
                                    'top': 0,
                                    'left': wall.width() - (settings.sidebar_width + 2*settings.padding),
                                    'padding': settings.padding
                                }, settings.fullscreen_speed, function() {});
                            }
                            
                            var p = $('#panel');
                            p.css({
                                'left': wall.width()/2 - p.width()/2,
                                'bottom': 0
                            })
                            var l = $('#loading');
                            l.css({
                                'left': wall.width()/2 - l.width()/2,
                            })
                            settings.fullscreen = false;
                            draw(wall);
                            
                        });
                        
                    } else {
                        // expand
                        wall.animate({
                            'width': $(document).width(),
                            'height': $(window).height(),
                            'top': 0,
                            'left': 0
                        }, settings.fullscreen_speed, function() { 
                            
                            if(sidebar.is(':visible')) {
                                sidebar.animate({
                                    'width': settings.sidebar_width,
                                    'height': wall.height() - 2*settings.padding,
                                    'top': 0,
                                    'left': wall.width() - (settings.sidebar_width + 2*settings.padding),
                                    'padding': settings.padding
                                }, settings.fullscreen_speed, function(){
                                    $(".sidebar_info", sidebar).height(sidebar.height() - $(".sidebar_image").height());
                                });
                            }
                            
                            var p = $('#panel');
                            p.css({
                                'left': wall.width()/2 - p.width()/2,
                                'bottom': 0
                            })
                            var l = $('#loading');
                            l.css({
                                'left': wall.width()/2 - l.width()/2,
                            })
                            settings.fullscreen = true;
                            
                            draw(wall);
                        });
                        
                    }
                    
                    
                    
                });
                
                // zoom in
                $('#panel span.zoomin').click(function(event) {
                    
                    event.preventDefault();
                    
                    max_size = settings.sizes.length-1;
                    if(settings.current_size < max_size) {
                        settings.current_size++;
                        resize(wall);
                        
                    } else {
                        showDialog(wall, settings.alert_msg_zoom_max);
                    }
                    
                    
                     
                });
                
                // zoom out
                $('#panel span.zoomout').click(function(event) {
                    
                    event.preventDefault();
                    
                    if(settings.current_size > 0) {
                    
                        settings.current_size--;
                        resize(wall);
                       
                        
                    } else {
                        showDialog(wall, settings.alert_msg_zoom_min);
                    }
                     
                });
                
                 // submit search
                $('#panel span.submitsearch', wall).click(function(event) {
                    
                    event.preventDefault();
                    
                    search_term = $('#panel input[name="search"]', wall).val();
                    if(search_term!='' && search_term != settings.search_box_default) {
                        
                        settings.search_category_name = '';
                        settings.search_category_pk = null;
                        settings.search_term = search_term;
                        
                        apiStart(wall, settings);
                        
                        
                    } else {
                        showDialog(wall, settings.alert_msg_enter_search);
                    }
                    
                });
                
                // - search input
                $('#panel input[name="search"]', wall).keyup(function(event) {
                   
                    event.preventDefault();
                    
                    var code = (event.keyCode ? event.keyCode : event.which);
                    if(code == 13) { // User has pressed the enter key
                        search_term = $(this).val();
                        if(search_term!='' && search_term != settings.search_box_default) {
                            
                            settings.search_category_name = '';
                            settings.search_category_pk = null;
                            settings.search_term = search_term;
                            
                            apiStart(wall, settings);

                        } else {
                            showDialog(wall, settings.alert_msg_enter_search);
                        }
                    }

                });
                
                // - search focus
                $('#panel input[name="search"]', wall).focus(function(event) {
                    
                    event.preventDefault();
                    $(this).val('');
                    
                });
                
                // - search click
                $('#panel input[name="search"]', wall).click(function(event) {
                    
                    event.preventDefault();
                    $(this).val('');
                    
                });
                
                // search from object title
                $('#sidebar .object-title', wall).click(function(event) {
                   
                    search_term = $("#objname").html();
                    $('#panel input[name="search"]', wall).val(search_term);
                    if(search_term!='' && search_term != settings.search_box_default) {
                        
                        settings.search_category_name = '';
                        settings.search_category_pk = null;
                        settings.search_term = search_term;
                        
                        apiStart(wall, settings);

                    } else {
                        showDialog(wall, settings.alert_msg_enter_search);
                    }
                    
                });
                
                
                // -shuffle 
                $('#panel span.shuffle', wall).click(function(event) {
                   
                    event.preventDefault();
                    
                    if(allow_shuffle) {
                    
                        $("#grid ul img", wall).attr('src', '').addClass('blank');
                        keys = [];
                        shuffle = [];
                        for(d=0; d<settings.max_offset; d++) { shuffle[Math.random() * 1] = d; }
                        for(r in shuffle) { keys.push(r); };
                        keys.sort();
                        tiles = $('#grid li img', wall);
                        count = 0;
                        for(k in keys) {
                            var item = retrieveFromCache(shuffle[keys[k]], cache);
                            $(tiles[count])
                                .attr('offset', shuffle[keys[k]])
                                .attr('src', getImageUrl(settings.images_url, item.imref))
                                .attr('alt', item.title + ' [' + item.num + ']')
                                .attr('title', item.title + ' [' + item.num + ']')
                                .attr('object_number', item.num)
                                .removeClass('blank')
                            count ++;
                        }
                        
                    }
                    
                });
                
                // close dialog box
                $('.ui-dialog-titlebar-close', wall).click(function(event) {
                    event.preventDefault();
                    //~ $('#dialog', wall).hide();
                    $(this).parent().parent().hide();
                });
                
                $('button', wall).click(function(event) {
                    event.preventDefault();
                    $('#dialog', wall).hide();
                });
                
                // click on an image and reveal sidebar
                $('#grid ul li img', wall).live('click', function(event) {
                   
                    url = settings.api_stub + $(this).attr('object_number');
                    
                    $('#fullsize').hide();
                    var sidebar = $("#sidebar", wall);
                    
                    sidebar.css({
                        'width': settings.sidebar_width,
                        'height': wall.height() - 2*settings.padding,
                        'top': 0,
                        'left': wall.width() - (settings.sidebar_width + 2*settings.padding),
                        'padding': settings.padding
                    });
                    
                    if(!sidebar.is(':visible')) {
                        sidebar.show();
                    }
                    
                    $.ajax({
                        dataType: 'jsonp',
                        url: url,
                        success: function (json) {
                            
                            musobj = json[0].fields;
                            image_url = settings.images_url + musobj.primary_image_id.substr(0, 6) + "/" + musobj.primary_image_id + settings.sidebar_image_suffix + ".jpg";
                            objname = musobj.object;
                            objtitle = '<span id="objname" title="Search for \'' + objname +'\'">' + objname + '</span>';
                            if(musobj.title) {
                                objname += ': ' + musobj.title;
                                objtitle += ': ' + musobj.title;
                            }
                            
                            var sidebar_image    =  '<img src="' + image_url + '" title="' + objname + '" alt="' + objname + '" width="'+ settings.sidebar_image_size +'" height="'+ settings.sidebar_image_size +'">';
                            $('span.object-title', sidebar).html('<span class="ui-icon ui-icon-search" style="float: left; margin-right: 2px;"></span>'+objtitle);
                            var info_html = '';
                            if(musobj.descriptive_line) {
                                info_html    +=  '<p>' + musobj.descriptive_line + '</p>';
                            }
                            info_html        +=  '<p>' + ucfirst(musobj.artist) +', ' + musobj.date_text + ', ' + musobj.museum_number + '</p>';
                            if(musobj.materials_techniques) {
                                info_html    +=  '<p>' + ucfirst(musobj.materials_techniques) + '</p>';
                            }
                            info_html        +=  '<p>' + settings.browse_prompt +'</p>';
                            info_html        +=  '<ul id="browse">';                            

                            var lines = 0;

                            for( k=0; k<settings.taxonomy.length; k++ ) {
                                
                                category = musobj[settings.taxonomy[k]];
                                if(countGroups(category) > 0) {
                                    taxonomy_title = ucfirst(settings.taxonomy[k]);
                                    
                                    info_html += '<li><h3>' + taxonomy_title + '</h3>';
                                    lines++;
                                    category_list = '<ul>';
                                    for( p=0; p < category.length; p++ ) {
                                        cat = category[p];
                                        category_name = ucfirst(cat.fields['name']);
                                        if( cat.fields['museumobject_count'] > settings.min_category_count && category_name != 'Unknown') {
                                            lines++;
                                            category_list += '<li><a href="#" category_source="' + cat.model.split('.')[1] + '" category_pk="' + cat.pk + '" category_term="' + category_name + '" title="Browse images for \'' + category_name + '\'">' + category_name + '</a></li>';
                                        };
                                        
                                    }
                                    category_list += '</ul>';
                                    info_html += category_list;
                                    info_html += '</li>';
                                    
                                }
                                
                            }
                            
                            if(lines==0) {
                                info_html += '<li>Sorry, no categories for this object.</li>';
                            }
                            
                            info_html       += '</ul>';
                            
                            $(".sidebar_image", sidebar).html(sidebar_image);
                            $(".sidebar_info", sidebar).html(info_html).height(sidebar.height() - $(".sidebar_image").outerHeight() - $(".ui-dialog-titlebar", sidebar).outerHeight()).scrollTop(0);
                            
                            // cache the fullsize img
                            var bigimg = new Image();
                            bigimg.src = image_url.replace(settings.sidebar_image_suffix, settings.large_image_suffix);
                            $('#fullsize img', wall).attr('src', bigimg.src);
                            $('#fullsize .ui-dialog-title').html(objname);
                            
                        }
                    });
                });
                
                // close the sidebar
                $('#sidebar a.close', wall).live('click', function(event) {
                 
                    event.preventDefault();
                    
                    $('#sidebar', wall).hide();
                    
                })
                
                // click on a category in the info panel and trigger a new search
                $('#browse a', wall).live('click', function(event) {
                   
                    event.preventDefault();

                    settings.search_category_name = $(this).attr('category_source');
                    settings.search_category_term = $(this).attr('category_term');
                    settings.search_category_pk = $(this).attr('category_pk');
                    
                    apiStart(wall, settings);
                    
                    $('#panel input[name="search"]', wall).val('New search');
            
                });
                
                // show fullsize image
                $('#sidebar img', wall).live('click', function(event) {
                    
                    event.preventDefault();
                    
                    fs = $('#fullsize', wall);
                    if(!fullsize_dragged) {
                        fs.css({
                            'top': 0,
                            'left': 0 
                        })
                    }
                    fs.show();
                    
                    
                });
                
            }
            
            function showLoading(wall) {
                
                l = $('#loading');
                l.css({
                    'left': wall.width()/2 - l.width()/2,
                    'top': wall.height()/2 - l.height()/2
                });
                l.show();
                
            }
            
            function showDialog(wall, msg) {
                dia = $('#dialog', wall);
                $('#dialog_text', dia).html(msg);
                dia.css({
                    'left': wall.width()/2 - dia.width()/2,
                    'top': wall.height()/2 - dia.height()/2
                });
                dia.show();
            }
            
            function apiStart(wall, settings) {
                
                ajax_in_progress = true;
                $('#panel .shuffle').addClass('disabled');
                allow_shuffle = false;
                
                $.ajax({
                    dataType: 'jsonp',
                    url: buildUrl(),
                    success: function (json) {
                        
                        if(json.meta.result_count <= settings.min_category_count) {
                            
                            showDialog(wall, settings.alert_msg_no_images);
                            
                        } else {
                        
                            showLoading(wall);
                        
                            if(typeof(cache_loop_id) != 'undefined') clearInterval(cache_loop_id);
                            if(typeof(fill_loop_id) != 'undefined') clearInterval(fill_loop_id);
                            if(typeof(cache) != 'undefined') delete cache;
                            offset = 0;
                            $("#grid ul img", wall).attr('src', '').attr('alt', '').addClass('blank');
                        
                            // from the result count set the grid size
                            settings.num_results = (json.meta.result_count > settings.max_results) ? settings.max_results : json.meta.result_count;
                            settings.display_results = parseInt(settings.num_results);
                            settings.grid_width = Math.floor(Math.sqrt(settings.num_results));
                            settings.grid_height = settings.grid_width;
                            settings.max_offset = settings.grid_width * settings.grid_height;
                            
                            $("#progressbar").progressbar({ value: 0, max: settings.max_offset });
                            
                            // populate control panel
                            $('#loading p.results_info', wall).html('Loading <strong><span class="loaded">0</span>/' + settings.display_results + '</strong> images for <strong>' + display_term + '</strong>');
                            
                            // add offset attributes
                            offset_anchor = 0;
                            num_cols = $("#grid>ul:first li", wall).size();
                            tiles = $('#grid>ul>li>img', wall);
                            count = 0;
                            row = 0;
                            o = offset_anchor;
                            for(k=0; k < tiles.size(); k++) {
                                
                                $(tiles[k]).attr('offset', o);
                                count++;
                                if(count==num_cols) {
                                    count = 0;
                                    row++;
                                    o = row * settings.grid_width;
                                } else {
                                    o++;
                                }
                                
                            }
                            ajax_in_progress = false;
                            
                            cache = new Array();
                            cache_loop_id = setInterval(function() { fillCache(settings, cache) }, settings.cache_interval);
                            fill_loop_id = setInterval(function() { fillTiles(settings, cache) }, settings.fill_interval);
                            
                        }
                        
                    }
                });
                return true;
            }
            
            function resize(wall) {
                
                d = settings.sizes[settings.current_size];
                settings.tile_width = d.dim;
                settings.tile_height = d.dim;
                settings.cell_width = settings.tile_width + settings.tile_margin + 2; // the '2' accounts for borders
                settings.cell_height = settings.tile_height + settings.tile_margin + 2; 
                settings.start_rows = Math.ceil(settings.height / settings.cell_height);
                settings.start_cols = Math.ceil(settings.width / settings.cell_width);
                settings.tile_sidebar_image_suffix = d.suff;
                
                $('#grid', wall).html('');
                $('#panel a.resize').removeClass('selected');
                $(this).addClass('selected');
                draw(wall);
                // add offset attributes
                offset_anchor = 0;
                num_cols = $("#grid>ul:first li", wall).size();
                tiles = $('#grid>ul>li>img', wall);
                count = 0;
                row = 0;
                o = offset_anchor;
                for(k=0; k < tiles.size(); k++) {
                    
                    $(tiles[k]).attr('offset', o);
                    count++;
                    if(count==num_cols) {
                        count = 0;
                        row++;
                        o = row * settings.grid_width;
                    } else {
                        o++;
                    }
                    
                }
                        
            }
            
            function buildUrl(offset, limit) {
                
                if(typeof(offset)=='undefined' || isNaN(offset)) {
                    offset = 0;
                }
                
                if(typeof(limit)=='undefined' || isNaN(limit)) {
                    limit = 1;
                }
                
                if(settings.search_category_name && settings.search_category_pk) {
                    
                    url = settings.api_stub;
                    url += '?' + settings.search_category_name + '=' + settings.search_category_pk;
                    //~ url += '&getgroup=' + settings.search_category_name;
                    display_term = ucfirst(settings.search_category_term);
                    
                } else {
                
                    url = settings.api_stub + settings.api_search_path;
                    url += "?q=" + settings.search_term;
                    display_term = ucfirst(settings.search_term);
                    
                }
                url += '&limit=' + limit;
                url += '&offset=' + offset;
                url += "&images=1";
                
                return url;
                
            }
            
            function drawEmptyRow(n) {
                
                r = '<ul>';
                for(j=0; j < n; j++) { r += settings.blank_tile; }
                r += '</ul>';
                return r;
            }
            
            function styleNewTiles(wall) {
             
                $('#grid li', wall).css({
                    'width': settings.tile_width,
                    'height': settings.tile_height,
                    'margin-right': settings.tile_margin,
                    'margin-bottom': settings.tile_margin,
                    'border-color': settings.tile_border_color
                });
                
            }
            
            function countGroups(category) {
                
                var c = 0;
                for ( n = 0; n < category.length; n++ ) {
                    if(category[0].fields['name'] != 'Unknown' && category[0].fields['museumobject_count'] > settings.min_category_count) {
                        c++;
                    }
                }
                return c;
                
            }
            
            function ucfirst(str) {
                
                return str.charAt(0).toUpperCase() + str.substr(1);

            }
            
            function draw(wall) {
            
                // before we do anything, let's get the current anchor offset
                
                offset_anchor = $("#grid ul:first li:first img").attr('offset');
            
                // is there any blank space inside the wall?
                var grid = $("#grid", wall);
                
                tiles = {
                    'above': Math.ceil(grid.position().top / settings.cell_height),
                    'left': Math.ceil(grid.position().left / settings.cell_width),
                    'below': Math.ceil((wall.height() - grid.position().top + grid.height()) / settings.cell_height),
                    'right': Math.ceil((grid.position().left + grid.width()) / settings.cell_width)
                }
                for(prop in tiles) { tiles[prop] = tiles[prop] <0 ? 0 : tiles[prop]; }
                
                do_offsets = false;
                
                // add new rows to top
                if(tiles.above) {
                    for(i=0;i<tiles.above;i++) {
                        grid.prepend(drawEmptyRow($("#grid ul:first > li", wall).size()));
                    }
                    do_offsets = true;
                }
                
                // add new rows to bottom
                if(tiles.below) {
                    for(i=0;i<tiles.below;i++) {
                        grid.append(drawEmptyRow($("#grid ul:first > li", wall).size()));
                    }
                    do_offsets = true;
                }
                
                // add new cols to left
                if(tiles.left) {
                    tl = '';
                    for(i=0;i<tiles.left;i++) {
                        tl += settings.blank_tile;
                    }
                    $("#grid ul", wall).prepend(tl);
                    do_offsets = true;
                }
                
                // add new cols to right
                if(tiles.right) {
                    tr = '';
                    for(i=0;i<tiles.right;i++) {
                        tr += settings.blank_tile;
                    }
                    $("#grid ul", wall).append(tr);
                    do_offsets = true;
                }
                
                // reposition and resize the grid AFTER adding new tiles
                grid.css({
                    'top': tiles.above > 0 ? grid.position().top - tiles.above * settings.cell_height  : grid.position().top,
                    'left': tiles.left > 0 ? grid.position().left - tiles.left * settings.cell_width : grid.position().left,
                    'width': $("#grid ul:first > li", wall).size() * settings.cell_width
                })

                // make sure all the new tiles are styled up
                styleNewTiles(wall);
                
                // find tiles outside the viewport and remove them
                remove = {
                    'left': Math.floor(grid.position().left * -1 / settings.cell_width),
                    'right': Math.floor((grid.width() - wall.width() + grid.position().left) / settings.cell_width),
                    'top': Math.floor(grid.position().top * -1 / settings.cell_height),
                    'bottom': Math.floor( (grid.height() - wall.height() + grid.position().top) / settings.cell_height)
                }
                
                for(p in remove) { remove[p] = remove[p] < 0 ? 0 : remove[p]; };
                
                tiles_removed = 0;
                while(tiles_removed < remove.left) {
                    $("#grid ul li:first-child").remove();
                    tiles_removed ++;
                    grid.css({'left': grid.position().left + settings.cell_width})
                }
                tiles_removed = 0;
                while(tiles_removed < remove.right) {
                    $("#grid ul li:last-child").remove();
                    tiles_removed ++;
                }
                rows_removed = 0;
                while(rows_removed < remove.top) {
                    $("#grid ul:first-child").remove();
                    rows_removed ++;
                    grid.css({'top': grid.position().top + settings.cell_height})
                }
                rows_removed = 0;
                while(rows_removed < remove.bottom) {
                    $("#grid ul:last-child").remove();
                    rows_removed ++;
                }
                                
                if(do_offsets) {
                    updateOffsets(wall, tiles, remove, settings);
                }
                
            };
            
            
            function updateOffsets(wall, tiles, remove, settings) {
            
                offset_anchor = parseInt(offset_anchor);
                
                if(tiles.above > 0) {
                    offset_anchor -= settings.grid_width * tiles.above;
                    if(offset_anchor < 0) {
                        offset_anchor += settings.max_offset;
                    }
                }
                
                if(tiles.left > 0) {
                    min = Math.floor(offset_anchor/settings.grid_width) * settings.grid_width;
                    max = min + settings.grid_width -1;
                    offset_anchor -= tiles.left;
                    if(offset_anchor < min) { offset_anchor += settings.grid_width };
                }
                
                offset_anchor += remove.left;
                offset_anchor -= remove.top * settings.grid_width;
                
                // TODO: fix this:
                if(offset_anchor < 0) offset_anchor = 0;
                
                offset = offset_anchor - settings.limit;
                
                num_cols = $("#grid>ul:first li", wall).size();
                rows = $('#grid>ul');
                
                for(j=0;j<rows.size();j++) {
                 
                    o = offset_anchor + (j * settings.grid_width);
                    if(o>=settings.max_offset) {
                        o -= settings.max_offset;
                    }
                 
                    images = $("img", rows[j]);
                    
                    min = Math.floor(o/settings.grid_width) * settings.grid_width;
                    max = min + settings.grid_width -1;
                 
                    for(i=0;i<images.size();i++) {
                        
                        $(images[i]).attr('offset', o);
                        o++;
                        if(o > max) {
                            o = min;
                        }
                        
                    }
                    
                    o = max + 1;
                    if(o >= settings.max_offset-1) {
                        o -= settings.max_offset;
                    }
                    
                }
                
            }
             
            function getImageUrl(url_base, image_ref) {
                return url_base + image_ref.substr(0, 6) + "/" + image_ref + settings.tile_sidebar_image_suffix + ".jpg";
            }
            
            function retrieveFromCache(offset) {
                for(q in cache) {
                    if(cache[q].offset == offset) return cache[q];
                }
                if(cache_full) {
                    $.ajax({
                            dataType: 'jsonp',
                            url: buildUrl(offset, 1),
                            success: function (json) {
                                for(i=0;i<json.records.length;i++) {
                                    record = json.records[i];
                                    obj = {};
                                    obj.offset = offset;
                                    obj.imref = record.fields.primary_image_id;
                                    obj.num = record.fields.object_number;
                                    if(record.fields.title) {
                                        objname = record.fields.object + ' ' + record.fields.title;
                                    } else {
                                        objname = record.fields.object;
                                    }
                                    obj.title = objname;
                                    cache.push(obj);
                                };
                            }
                        });
                }
                return false;
            }
                
            function fillCache(settings, cache) {

                if(typeof(offset)=='undefined' || isNaN(offset) || offset < 0) {
                    offset = 0;
                }
                
                if(cache.length < settings.max_offset) {
                
                    cache_full = false;
                
                    if(!ajax_in_progress) {
                
                        ajax_in_progress = true;
                        url = buildUrl(offset, settings.limit);
                        $.ajax({
                            dataType: 'jsonp',
                            url: url,
                            success: function (json) {
                                for(i=0;i<json.records.length;i++) {
                                    record = json.records[i];
                                    cache_obj = {};
                                    cache_obj.offset = offset;
                                    cache_obj.imref = record.fields.primary_image_id;
                                    cache_obj.num = record.fields.object_number;
                                    if(record.fields.title) {
                                        objname = record.fields.object + ' ' + record.fields.title;
                                    } else {
                                        objname = record.fields.object;
                                    }
                                    cache_obj.title = objname;
                                    cache.push(cache_obj);
                                    offset ++;
                                };
                                if(offset >= settings.max_offset && cache.length < settings.max_offset) { offset = 0; };
                                ajax_in_progress = false;
                                $("#progressbar").progressbar({ value: cache.length });
                                $("#loading .loaded").html(cache.length);
                            }
                        });
                    
                    }
                    
                } else { // cache is full
                    $('#panel .shuffle').removeClass('disabled');
                    allow_shuffle = true;
                    clearInterval(cache_loop_id);
                    cache_full = true;
                    setTimeout(hideLoading, settings.hide_loader_time);
                    $("#loading .loaded").html(settings.display_results);
                    r = Math.floor(Math.random()*settings.tips.length);
                    $("#loading .results_info").html('<span style="float: left; margin-right: .3em;" class="ui-icon ui-icon-info"></span><strong>Tip:</strong> ' + settings.tips[r]);
                }
                
            }
            
            function hideLoading() {
                $('#loading').fadeOut();
            }
            
            function fillTiles(settings, cache) {
               
                emp = $("img.blank:first");
                var item = retrieveFromCache(emp.attr('offset'), cache);
                if(item) {
                    emp.attr('src', getImageUrl(settings.images_url, item.imref))
                        .attr('alt', item.title + ' [' + item.num + ']')
                        .attr('title', item.title + ' [' + item.num + ']')
                        .attr('object_number', item.num)
                        .fadeIn(settings.img_fadein)
                        .removeClass('blank');
                } 
                
            }
        })

    }

})( jQuery );

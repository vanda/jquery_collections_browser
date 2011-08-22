/*!
 * Victoria and Albert Museum Collections Browser jQuery plugin
 * http://www.vam.ac.uk/
 *
 * Copyright 2011, Victoria and Albert Museum
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
 
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
                'min_category_count': 30, // minimum number of objects a category must have to be displayed in the sidebar panel (because, say 10 objects don't make a good wall)
                'padding': 8, // amount of padding to add to elements that require padding
                'wall_border': '1px solid #a1a1a1',
                'panel_width': 'auto',
                'hide_loader_time': 2000, // how long to display the loading dialog after the images are all loaded
                'fill_direction': 'random', // what order to fill blank tile - values are 'forwards', 'backwards' or 'random'
                'tag_style': 'list', // how to display the tags - values are 'tagcloud', or 'list'
                'display_loading': false, // whether to display the loading dialog
                                
                // messaging
                'search_box_default': 'New search', // initial text in the search box
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
                'search_term': '', // the search to display. 
                'category': { // the category to display
                    'id': null,
                    'name': '',
                    'term': ''
                },
                'max_results': 1000, // the max results we can handle
                'limit': 41, // how many images to get per api request
                'search_term': '', // term to search the api for
                'category-stub': '', // category to retrieve images from 
                'sidebar_image_suffix': '_jpg_w',
                'large_image_suffix': '_jpg_l',
                
                // html fragments
                'blank_tile': '<li class="blank"></li>',
                
                // nuts and bolts
                'cache_interval': 50, // how often to cache some images (ms)
                'fill_interval': 5, // how often to fill tiles from cache (ms)
                
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
                ],
                
                // fields to display in sidebar
                'tombstone': [
                    ['Artist', 'artist' ],
                    ['Date', 'date_text' ],
                    ['Museum no.', 'museum_number' ],
                    ['Materials &amp; techniques', 'materials_techniques'],
                    ['Location', 'location'],
                    ['History note', 'history_note']
                ]
                
            };

            

            var settings = $.extend({}, defaults, options); 

            init($(this), settings);

            function init(wall, settings) {
             
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
                    'border': settings.wall_border
                });
                $("#grid", wall).css({
                    'width': settings.cell_width * settings.start_cols
                });
                styleTiles(wall);

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
                
                // title bar
                var title       =       '<div class="ui-widget"><div id="title" class="ui-dialog ui-widget ui-widget-content ui-corner-all us-status-highlight">';
                title           +=      '<h1 class="title_info"></h1>';
                title           +=      '</div></div>';
                
                // fullsize dialog
                var fs          =       '<div id="fullsize" class="ui-dialog ui-widget ui-widget-content ui-corner-all">';
                fs              +=       '<div class="ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix"><span class="ui-dialog-title"></span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button"><span class="ui-icon ui-icon-closethick">close</span></a></div>';
                fs              +=      '<img src="" alt="" title="" />';
                fs              +=      '</div>';
                
                var disabled     =       '<div id="disabled"></div>';
                
                $("#grid").after(sidebar_html).after(panel).after(dialog).after(loading).after(title).after(fs).after(disabled);
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

                wall
                    .delegate('#icons li span', 'mouseover', function(event) {
                        $(this).parent().addClass('ui-state-hover');
                    })
                    .delegate('#icons li span', 'mouseout', function(event) {
                        $(this).parent().removeClass('ui-state-hover');
                    })
                    .delegate('#panel span.fullscreen', 'click', function(event) {
                        event.preventDefault();
                        
                        var sidebar = $("#sidebar", wall);
                        
                        if (settings.fullscreen) {
                            // shrink
                            $("body").css({'overflow': 'auto'});
                            wall.prependTo(old_parent)
                                .animate({
                                'width': settings.width,
                                'height': settings.height,
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
                                
                                var p = $('#panel', wall);
                                $("#sidebar").hide();
                                p.css({'left':0}).css({
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
                            
                            old_parent = wall.parent();
                            wall.prependTo($("body"));
                            $("body").css({'overflow': 'hidden'});
                            $(window).scrollTop(0);
                            wall.animate({
                                'width': $(document).width(),
                                'height': $(window).height(),
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
                        
                        
                        
                    })
                    .delegate('#panel span.zoomin', 'click', function(event) {
                        
                        event.preventDefault();
                        
                        max_size = settings.sizes.length-1;
                        if(settings.current_size < max_size) {
                            settings.current_size++;
                            resize(wall);
                            
                        } else {
                            showDialog(wall, settings.alert_msg_zoom_max);
                        }
                        
                        
                         
                    })
                    .delegate('#panel span.zoomout', 'click', function(event) {
                        
                        event.preventDefault();
                        
                        if(settings.current_size > 0) {
                        
                            settings.current_size--;
                            resize(wall);
                           
                            
                        } else {
                            showDialog(wall, settings.alert_msg_zoom_min);
                        }
                         
                    })
                    .delegate('#panel span.submitsearch', 'click', function(event) {
                        
                        event.preventDefault();
                        
                        search_term = $('#panel input[name="search"]', wall).val();
                        if(search_term!='' && search_term != settings.search_box_default) {
                            
                            settings.category = {
                                'id': null,
                                'name': '',
                                'term': '',
                            }
                            settings.search_term = search_term;
                            apiStart(wall, settings);
                            
                            
                        } else {
                            showDialog(wall, settings.alert_msg_enter_search);
                        }
                        
                    })
                    .delegate('#panel input[name="search"]', 'keyup', function(event) {
                       
                        event.preventDefault();
                        
                        var code = (event.keyCode ? event.keyCode : event.which);
                        if(code == 13) { // User has pressed the enter key
                            search_term = $(this).val();
                            
                            if(search_term!='' && search_term != settings.search_box_default) {
                                
                                settings.category = {
                                    'id': null,
                                    'name': '',
                                    'term': '',
                                }
                                settings.search_term = search_term;
                                apiStart(wall, settings);

                            } else {
                                showDialog(wall, settings.alert_msg_enter_search);
                            }
                        }

                    })
                    .delegate('#panel input[name="search"]', 'focus', function(event) {
                        
                        event.preventDefault();
                        $(this).val('');
                        
                    })
                    .delegate('#panel input[name="search"]', 'click', function(event) {
                        
                        event.preventDefault();
                        $(this).val('');
                        
                    })
                    .delegate('.searchable', 'click', function(event) {
                       
                        search_term = $(this).html();
                        $('#panel input[name="search"]', wall).val(search_term);
                        if(search_term!='' && search_term != settings.search_box_default) {
                            
                            settings.category = {
                                'id': null,
                                'name': '',
                                'term': '',
                            }
                            settings.search_term = search_term;
                            apiStart(wall, settings);

                        } else {
                            showDialog(wall, settings.alert_msg_enter_search);
                        }
                        
                    })
                    .delegate('#panel span.shuffle', 'click', function(event) {
                       
                        event.preventDefault();
                        
                        if(allow_shuffle) {
                        
                            keys = [];
                            shuffle = [];
                            for(d=0; d<settings.max_offset; d++) { shuffle[Math.random() * 1] = d; }
                            for(r in shuffle) { keys.push(r); };
                            keys.sort();
                            tiles = $('#grid li', wall);
                            count = 0;
                            for(k in keys) {
                                fillTile($(tiles[count]), retrieveFromCache(shuffle[keys[k]], cache));
                                count ++;
                            }
                            
                        }
                        
                    })
                    .delegate('.ui-dialog-titlebar-close', 'click', function(event) {
                        event.preventDefault();
                        $(this).parent().parent().hide();
                    })
                    .delegate('button', 'click', function(event) {
                        event.preventDefault();
                        $('#dialog', wall).hide();
                    })
                    .delegate('#grid ul li', 'click', function(event) { 
                       
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
                        
                        var disabled = $("#disabled", wall);
                        disabled.css({
                            'width': settings.sidebar_width,
                            'height': wall.height() - 2*settings.padding,
                            'top': 0,
                            'left': wall.width() - (settings.sidebar_width + 2*settings.padding),
                            'padding': settings.padding,
                            'z-index': 50
                        }).show();
                        
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
                                objtitle = '<span id="objname" class="searchable" title="Search for \'' + objname +'\'">' + objname + '</span>';
                                if(musobj.title) {
                                    objname += ': ' + musobj.title;
                                    objtitle += ': ' + musobj.title;
                                }
                                
                                var sidebar_image    =  '<img src="' + image_url + '" title="' + objname + '" alt="' + objname + '" width="'+ settings.sidebar_image_size +'" height="'+ settings.sidebar_image_size +'">';
                                $('span.object-title', sidebar).html('<span class="ui-icon ui-icon-search" style="float: left; margin-right: 2px;"></span>'+objtitle);

                                var info_html = '';
                                if(typeof(musobj.descriptive_line) != 'undefined' && musobj.descriptive_line != '' && musobj.descriptive_line != ['Unknown']) { 
                                    info_html += '<div class="ui-widget ui-state-highlight ui-corner-all">' + musobj.descriptive_line + '</div>';
                                }
                                info_html += '<div class="ui-widget ui-state-highlight ui-corner-all">';
                                info_html +=    '<ul>';
                                for(k=0; k<settings.tombstone.length; k++) {
                                    t = settings.tombstone[k][0];
                                    c = settings.tombstone[k][1];
                                    if(typeof(musobj[c]) != 'undefined' && musobj[c] != '' && musobj[c] != ['Unknown']) { 
                                        info_html += '<li><strong>'+t + '</strong>: ' + musobj[c] +'</li>'; 
                                    };
                                }
                                info_html        +=  '</ul></div>';
                                info_html        += '<div class="ui-widget ui-state-highlight ui-corner-all" id="browse">';
                                info_html        +=  '<ul class="' + settings.tag_style + '">';                            

                                var lines = 0;

                                for( k=0; k<settings.taxonomy.length; k++ ) {
                                    
                                    category = musobj[settings.taxonomy[k]];
                                    if(countGroups(category) > 0) {
                                        taxonomy_title = ucfirst(settings.taxonomy[k]);
                                        lines++;
                                        if(settings.tag_style == 'list') {
                                            info_html += '<li><strong>' + taxonomy_title + '</strong>';
                                            info_html += '<ul>';
                                        }
                                        for( p=0; p < category.length; p++ ) {
                                            // TO DO: algoritmo for tag sizing
                                            s = Math.floor(Math.random()*6);
                                            cat = category[p];
                                            category_name = ucfirst(cat.fields['name']);
                                            if( cat.fields['museumobject_count'] > settings.min_category_count && category_name != 'Unknown') {
                                                lines++;
                                                info_html += '<li class="size-'+parseInt(s)+'"><a href="#" data-name="' + cat.model.split('.')[1] + '" data-pk="' + cat.pk + '" data-term="' + category_name + '" title="Browse images for \'' + category_name + '\'">' + category_name + '</a></li>';
                                            };
                                        }
                                        if(settings.tag_style == 'list') info_html += '</ul>';
                                        info_html += '</li>';
                                    }
                                    
                                }
                                
                                if(lines==0) {
                                    info_html += '<li>Sorry, no categories for this object.</li>';
                                }
                                
                                info_html       += '</ul><div class="clearfix"></div></div>';
                                
                                $(".sidebar_image", sidebar).html(sidebar_image);
                                $(".sidebar_info", sidebar).html(info_html).height(sidebar.height() - $(".sidebar_image").outerHeight() - $(".ui-dialog-titlebar", sidebar).outerHeight()).scrollTop(0);
                                
                                // cache the fullsize img
                                var bigimg = new Image();
                                bigimg.src = image_url.replace(settings.sidebar_image_suffix, settings.large_image_suffix);
                                $('#fullsize img', wall).attr('src', bigimg.src);
                                $('#fullsize .ui-dialog-title').html(objname);
                                
                                // remove disabler overlay
                                disabled.fadeOut();
                                
                            }
                        });
                    })
                    .delegate('#sidebar a.close', 'click', function(event) { 
                     
                        event.preventDefault();
                        
                        $('#sidebar', wall).hide();
                        
                    })
                    .delegate('#browse a', 'click', function(event) { 
                       
                        event.preventDefault();
                        
                        settings.category = {
                            'id': $(this).data('pk'),
                            'name': $(this).data('name'),
                            'term': $(this).data('term'),
                        }
                        apiStart(wall, settings);
                        
                        $('#panel input[name="search"]', wall).val('New search');
                
                    })
                    .delegate('#sidebar img', 'click', function(event) { 
                        
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
                $("span.ui-dialog-title", l).html("Please wait...");
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
                        
                            if(settings.show_loading) { showLoading(wall); };
                        
                            if(typeof(cache_loop_id) != 'undefined') clearInterval(cache_loop_id);
                            if(typeof(fill_loop_id) != 'undefined') clearInterval(fill_loop_id);
                            if(typeof(cache) != 'undefined') delete cache;
                            offset = 0;
                            $("#grid ul li", wall).addClass('blank');
                        
                            // from the result count set the grid size
                            settings.num_results = (json.meta.result_count > settings.max_results) ? settings.max_results : json.meta.result_count;
                            settings.display_results = parseInt(settings.num_results);
                            settings.grid_width = Math.floor(Math.sqrt(settings.num_results));
                            settings.grid_height = settings.grid_width;
                            settings.max_offset = settings.grid_width * settings.grid_height;
                            
                            // populate title bar
                            if(settings.category.id != null) {
                                var title_text = 'Browsing ' + settings.num_results + ' images for ' + ucfirst(settings.category.name) + ': '+ ucfirst(settings.category.term);
                            } else {
                                var title_text = 'Browsing ' + settings.num_results + ' images for "' + settings.search_term + '"';
                            }
                            $("#title h1", wall).html(title_text);
                            
                            $("#progressbar").progressbar({ value: 0, max: settings.max_offset });
                            
                            // populate control panel
                            $('#loading p.results_info', wall).html('Loading <strong><span class="loaded">0</span>/' + settings.display_results + '</strong> images');
                            
                            // add offset attributes
                            offset_anchor = 0;
                            num_cols = $("#grid>ul:first li", wall).size();
                            tiles = $('#grid>ul>li', wall);
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
                tiles = $('#grid>ul>li', wall);
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
                
                if(settings.category.id != null) {
                    
                    url = settings.api_stub;
                    url += '?' + settings.category.name + '=' + settings.category.id;
                    url += '&getgroup=' + settings.category.name;
                    display_term = ucfirst(settings.category.term);
                    
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
            
            function styleTiles(wall) {
             
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
                
                offset_anchor = $("#grid ul:first li:first", wall).attr('offset');
            
                // is there any blank space inside the wall?
                var grid = $("#grid", wall);
                
                grid.width(grid.width() + wall.position().left + wall.width());
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
                    'width': $("#grid ul:first > li", wall).length * settings.cell_width
                })
                
                // make sure all the new tiles are styled up
                styleTiles(wall);
                
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
                            
                grid.width($("#grid ul:first > li", wall).length * settings.cell_width);
                            
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
                 
                    tiles = $("li", rows[j]);
                    
                    min = Math.floor(o/settings.grid_width) * settings.grid_width;
                    max = min + settings.grid_width -1;
                 
                    for(i=0;i<tiles.size();i++) {
                        
                        $(tiles[i]).attr('offset', o);
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
                
                try {
                    u = url_base + image_ref.substr(0, 6) + "/" + image_ref + settings.tile_sidebar_image_suffix + ".jpg";
                } catch(err) {
                    u = "";
                }
                return u;
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
                    $('#loading span.ui-dialog-title').html('Done.');
                    $('#loading .results_info').html('<span style="float: left; margin-right: .3em;" class="ui-icon ui-icon-info"></span><strong>Tip:</strong> ' + settings.tips[r]);
                }
                
            }
            
            function hideLoading() {
                $('#loading').fadeOut();
            }
            
            function fillTile(tile, item) {
                
                tile
                    .css({ 'background-image': 'url('+getImageUrl(settings.images_url, item.imref)+')'})
                    .attr('title', item.title + ' [' + item.num + ']')
                    .attr('object_number', item.num)
                    .removeClass('blank');
                
            }
            
            function fillTiles(settings, cache) {
               
                switch(settings.fill_direction) {
                    case 'forwards':
                        t = $("ul li.blank:first");
                        break;
                    case 'backwards':
                        t = $("ul li.blank:last");
                        break;
                    case 'random':
                        tt = $("ul li.blank");
                        t = $(tt[Math.floor(Math.random()*tt.length)]);
                        break;
                    default:
                        t = $("ul li.blank:first");
                        break;
                }
                var item = retrieveFromCache(t.attr('offset'), cache);
                if(item) {
                    fillTile(t, item);
                } 
                
            }
        })

    }

})( jQuery );

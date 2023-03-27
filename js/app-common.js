'use strict';
(function() {
  // ----------
  window.App = _.extend(window.App || {}, {
    colorPaletteLength: 12,

    // ----------
    addSlider: function(args) {
      var self = this;
      var container = $(args.container)[0];

      var div = document.createElement('div');
      div.classList.add('input-row');
      container.appendChild(div);

      var sliderLabel = document.createTextNode(' ' + args.label + ': ');
      div.appendChild(sliderLabel);

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = args.min || 0;
      slider.max = args.max || 100;
      slider.step = args.step || 1;
      slider.value = args.value || 0;
      div.appendChild(slider);

      var sliderValue = document.createTextNode(' ' + slider.value);
      div.appendChild(sliderValue);

      slider.addEventListener('input', function() {
        args.onChange(parseFloat(slider.value));
        sliderValue.textContent = ' ' + slider.value;
      });

      return {
        getValue: function() {
          return slider.value;
        },
        setValue: function(value) {
          slider.value = value;
          sliderValue.textContent = ' ' + slider.value;
        }
      };
    },

    // ----------
    addMenu: function(args) {
      console.assert(args.container, 'container is required');
      console.assert(args.label, 'label is required');
      console.assert(args.labels, 'labels is required');
      console.assert(args.values, 'values is required');
      console.assert(args.value !== undefined, 'value is required');
      console.assert(args.onChange, 'onChange is required');
      console.assert(
        args.labels.length === args.values.length,
        'labels and values must have the same number of items'
      );

      var $div = $('<div>')
        .text(args.label + ': ')
        .appendTo($(args.container));

      var $menu = $('<select>').appendTo($div);

      _.each(args.values, function(value, i) {
        var label = args.labels[i];
        $('<option>')
          .val(value)
          .text(label)
          .appendTo($menu);
      });

      $menu.val(args.value).on('change', function() {
        args.onChange($menu.val());
      });
    },

    // ----------
    getHueFromPaletteIndex: function(index) {
      return Math.round(DSA.mapLinear(index, 0, this.colorPaletteLength, 0, 360, true));
    },

    // ----------
    addColorPalette: function(args) {
      console.assert(args.container, 'container is required');
      console.assert(args.onClick, 'onClick is required');

      var normalBorder = '1px solid #eee';
      var selectedBorder = '1px solid #000';
      var $boxes = $();

      var $div = $('<div>')
        .css({
          display: 'flex',
          width: '100%',
          height: 20,
          margin: '4px 0'
        })
        .on('click', function(event) {
          $boxes.css({
            border: normalBorder
          });

          var $target = $(event.target);
          $target.css({
            border: selectedBorder
          });

          var hue = parseFloat($target.data('hue'));
          if (!_.isNaN(hue)) {
            args.onClick(hue);
          }
        })
        .appendTo($(args.container));

      var i, hue, color;
      for (i = 0; i < this.colorPaletteLength; i++) {
        hue = this.getHueFromPaletteIndex(i);
        color = 'hsl(' + hue + ', 100%, 50%)';

        $boxes = $boxes.add(
          $('<div>')
            .css({
              background: color,
              'flex-grow': 1,
              border: normalBorder,
              cursor: 'pointer'
            })
            .data('hue', hue)
            .appendTo($div)
        );
      }

      return {
        clearSelection: function() {
          $boxes.css({
            border: normalBorder
          });
        }
      };
    },

    /**
    *    Depends on App.demoImages being populated appropriately
    *    
    **/
    createImagePicker: function(staticViewer, movingViewer, imageSelectionButton){
      // use App.demoImages to create image picker data
      let cases = App.demoImages.reduce((acc, item, index)=>{
        if(!acc[item.meta.accession]){
            acc[item.meta.accession] = {items: []};
        }
        acc[item.meta.accession].items.push(item);
        item.index = index; 
        return acc; 
      }, {});
      Object.values(cases).forEach( c => {
          c.blocks = c.items.reduce((acc,item)=>{
              let block = item.meta.block.replace(':00 AM', ' A').replace(':00 PM', ' P');
              if(!acc[block]){
                  acc[block] = [];
              }
              acc[block].push(item); 
              return acc; 
          }, {});
      });

      let html = `
        <div class="select-images">
        <div class="select-images-ui">
          <div class="select-images-header"><span>Static image</span><span>Moving image</span></div>
          <div class="image-picker"></div>
        </div>
        
      </div>
      `;
      let css = `
      .select-images-ui{
          display:grid;
          grid-template-rows:auto 1fr;
          max-height:80vh;
      }
      .select-images-header{
          display: grid;
          grid-template-columns: 50% 50%;
          text-align: center;
      }
      .image-picker{
          overflow:auto;
      }
      .blocklist{
          display:grid;
          grid-template-columns:auto 1fr 1fr;
      }
      .slidelist{
          display:flex;
      }
      .block-name{
          white-space: nowrap;
      }
      .thumbnail{
          width:64px;
      }
      .thumbnail.selected{
          outline:medium solid black;
          z-index:1;
      }
      .thumbnail:not(.selected):hover{
          outline:medium gray solid;
          z-index:2;
      }
      .case{
          border:thin gray solid;
          border-radius:5px;
          padding:5px;
      }
      .case-name{
          cursor:pointer;
      }
      .blocklist.collapsed{
          height:1em;
          overflow:hidden;
      }
      `;
      let imageSelectionWindow = $(html).appendTo('body');
      let imageSelectionCSS = $('<style>').html(css).appendTo('head');
      imageSelectionWindow.dialog({title:'Pick images to sync',width:'auto',autoOpen:false,});
      
      if(!imageSelectionButton){
        imageSelectionButton = $('<button>').text('Select Images');
      } else {
        imageSelectionButton = $(imageSelectionButton);
      }

      imageSelectionButton.on('click',()=>imageSelectionWindow.dialog('open'));
      
      imageSelectionWindow.on('click', '.case-name', ev=>{
          $(ev.currentTarget).closest('.case').find('.blocklist').toggleClass('collapsed');
      }).on('click','.thumbnail',ev=>{
          let img = $(ev.currentTarget);
          let d = img.data();
          let index;
          let imageType;
          if(img.hasClass('static')){
              $('.thumbnail.static.selected').removeClass('selected');
              window.localStorage.setItem('static-index',d.index);
              index = 0;
              imageType = 'static';
          }
          if(img.hasClass('moving')){
              $('.thumbnail.moving.selected').removeClass('selected');
              window.localStorage.setItem('moving-index',d.index);
              index = 1;
              imageType = 'moving';
          }
          img.addClass('selected');
          
          d.viewer.world.addOnceHandler('add-item',(event)=>{
            d.viewer[`_userdata_${imageType}`] = event.item;
          });
          let options = {
            tileSource: d.block.tileSource,
            index: index,
          }
          if(d.viewer[`_userdata_${imageType}`] ){
            options.index = d.viewer.world.getIndexOfItem(d.viewer[`_userdata_${imageType}`]);
            options.replace = true;
          }
          d.viewer.addTiledImage(options);
      })
      let imagePicker=$('.image-picker').empty();
      Object.keys(cases).forEach(name=>{
          let blocks = cases[name].blocks;
          let c = $('<div>',{class:'case'});
          $('<div>',{class:'case-name'}).text(name).appendTo(c);
          let blocklist=$('<div>',{class:'blocklist'}).appendTo(c);
          Object.keys(blocks).sort((a,b)=>a.length - b.length || a.localeCompare(b)).forEach(blockKey=>{
              $('<span>',{class:'block-name'}).appendTo(blocklist).text(blockKey);
              let staticList=$('<span>',{class:'slidelist'}).appendTo(blocklist);
              let movingList=$('<span>',{class:'slidelist'}).appendTo(blocklist);
              blocks[blockKey].forEach(block=>{
                  $('<img>',{class:'thumbnail static',title:block.meta.stain,src:block.tileSource.thumbnailUrl,loading:'lazy'})
                    .appendTo(staticList).data({viewer:staticViewer, block: block, index: block.index});
                  $('<img>',{class:'thumbnail moving',title:block.meta.stain,src:block.tileSource.thumbnailUrl,loading:'lazy'})
                    .appendTo(movingList).data({viewer:movingViewer, block: block, index: block.index});
              })
          });
          imagePicker.append(c);
      });

      let staticIndex = window.localStorage.getItem('static-index');
      let movingIndex = window.localStorage.getItem('moving-index');
      $('.thumbnail.static').filter((i,el)=>$(el).data('index')==staticIndex).trigger('click');
      $('.thumbnail.moving').filter((i,el)=>$(el).data('index')==movingIndex).trigger('click');

      return imageSelectionButton;
    
    }
  });
})();

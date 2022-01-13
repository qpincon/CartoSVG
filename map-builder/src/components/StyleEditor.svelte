<script>
  import Picker from 'vanilla-picker';
  import RangeSlider from "svelte-range-slider-pips";

  import {onMount} from 'svelte';

  export let elementToListen = null;
  export let cssRuleToFind = null;
  let cssSheet = null;
  let self;
  let colorPicker;
  let propertyColor = null;
  let currentRules = null;
  let colorPropChoices = {};
  let selectedColorPropVerbose = null;
  let fontSize = [];
  
  $: {
    if (elementToListen !== null) {
      init();
    }
  }
  onMount(() => {
    colorPicker = new Picker({
        parent: document.getElementById('color-picker'),
        popup: false,
        onChange: function(color) {
          if (!propertyColor) return;
          propertyColor.forEach(prop => {
            currentRules.forEach(rule => {
              rule.style.setProperty(prop, color.rgbaString);
            })
          });
        },
      });
      hide();
      document.body.appendChild(self);
  });

  function init() {
    let same = false;
    for (let sheetIndex = 0; sheetIndex < document.styleSheets.length; sheetIndex++) {
      if (same) break;
      cssSheet = document.styleSheets[sheetIndex];
      for (let ruleIndex = 0; ruleIndex < cssSheet.cssRules.length; ruleIndex++) {
        const rule = cssSheet.cssRules[ruleIndex];
        const selector = rule.selectorText;
        if (!selector.includes('.')) continue;
        
        // really basic at the moment: just get the last class defined in the rule
        const classes = rule.selectorText.split(/\./);
        const lastClass = classes[classes.length - 1];
        same = '.' + lastClass == cssRuleToFind;
        if (same) break;
      }
    }

    elementToListen.addEventListener('click', (e) => {
      colorPropChoices = {};
      fontSize = [];
      const classes = Array.from(e.target.classList);
      currentRules = findRulesFromClasses(cssSheet.cssRules, classes);
      if (!currentRules.length) return hide();
      show();
      self.style.display = 'block';
      self.style.left = (e.pageX + 15) + 'px';
      self.style.top =  (e.pageY + 15) + 'px';
      if (!currentRules.length) return;
      currentRules.forEach(rule => {
        const currentStyle = rule.style;
        for (let i = currentStyle.length; i--;) {
          const propName = currentStyle[i];
          if (propName == 'background-color') {
            colorPropChoices['Background'] = ['background-color'];
          }
          else if (propName.includes('border') && propName.includes('color')) {
            if(!colorPropChoices['Border']) colorPropChoices['Border'] = new Set([propName]);
            else colorPropChoices['Border'].add(propName); 
          }
          else if (propName == 'color') {
            colorPropChoices['Text color'] = ['color'];
          }
          else if (propName == 'font-size') {
            fontSize = [parseInt(currentStyle.getPropertyValue('font-size').replace(/\D+$/g, ""))]; // remove non-digit suffix
          }
        }
      });
      if (colorPropChoices['Border']) colorPropChoices['Border'] = Array.from(colorPropChoices['Border']);
      const propChoicesKeys = Object.keys(colorPropChoices);
      if (propChoicesKeys.length) selectColoredProp(propChoicesKeys[0]);
    });
  }

  // returns all the rules from the RuleList containing at least one of the provided classes 
  function findRulesFromClasses(ruleList, classes) {
    const rules = [];
    for (let ruleIndex = 0; ruleIndex < ruleList.length; ruleIndex++) {
      const rule = ruleList[ruleIndex];
      const selector = rule.selectorText;
      const selectorSplitted = selector.split(/ |,|\./).filter(p => p);
      selectorSplitted.forEach(selectorPart => {
        for (let className of classes) {
          if (selectorPart == className) {
            rules.push(rule);
            return;
          }
        }
      });
    }
    return rules;
  }

  function selectColoredProp(propNameVerbose) {
    if(!colorPicker) return;
    const propName = colorPropChoices[propNameVerbose];
    selectedColorPropVerbose = propNameVerbose;
    propertyColor = propName;
    colorPicker.setOptions({color: currentRules[0].style.getPropertyValue(propName[0])});
  }

  function hide() {
    self.style.display = 'none';
    
  }
  
  function show() {
    self.style.display = 'block';
  }

  function changeFontSize() {
    currentRules.forEach(rule => {
      rule.style.setProperty('font-size', fontSize[0] + 'px');
    });
  }

</script>

<div class="wrapper" bind:this={self}>
  <div class="inner-wrapper">
    <div class="close-button" on:click={hide}>x</div>
    {#if fontSize.length}
    <div class="font-size">
      <span> Font size </span>
      <RangeSlider bind:values={fontSize} min={2} max={40} float on:change={changeFontSize}/>
    </div>
    {/if}
    <div class="selectable-color-props">
      {#each Object.keys(colorPropChoices) as colorable}
        <div class="select-colorable" on:click="{selectColoredProp(colorable)}" class:selected="{selectedColorPropVerbose === colorable}">
          {colorable}
        </div>
      {/each}
    </div>
    <div id="color-picker"></div>
  </div>
</div>

<style>
  .wrapper {
    position: absolute;
  }
  .inner-wrapper {
    position: relative;
  }
  .close-button {
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: #dbdbdb;
    color: #818181;
    border-radius: 100%;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
  .selectable-color-props, .font-size {
    display: flex;
    background-color: #f2f2f2;
    align-items: center;
    box-shadow: 0 0 0 1px silver;
  }
  :global(.font-size .rangeSlider) {
    flex: 1 0 auto;
  }

  .select-colorable {
    padding: 5px 10px;
    cursor: pointer;
  }
  .select-colorable.selected {
    background-color: #ffffff;
    border-bottom: 1px solid silver;
  }
</style>
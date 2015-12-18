/// <reference path="../decl/handlebars/handlebars.d.ts" />
"use strict";

let url = URI(document.location.href);
let query: any = URI.parseQuery(url.query());

let $_ = (x) => document.getElementById(x);

function renderContract(contract) {
  let showAmount = document.getElementById("show-amount");
  $_('merchant-name').innerText = contract.merchant.name;
}

function clone(obj) {
  // This is faster than it looks ...
  return JSON.parse(JSON.stringify(obj));
}


Handlebars.registerHelper('prettyAmount', function(amount) {
  let v = amount.value + amount.fraction / 10e6;
  return v.toFixed(2) + " " + amount.currency;
});


document.addEventListener("DOMContentLoaded", (e) => {
  let offer = JSON.parse(query.offer);
  console.dir(offer);

  let source = $_("contract-template").innerHTML;
  let template = Handlebars.compile(source);
  let html = template(offer.contract);

  $_("render-contract").innerHTML = html;

  document.getElementById("confirm-pay").addEventListener("click", (e) => {
    console.log("Query:", JSON.stringify(query));
    let d = {
      offer: JSON.parse(query.offer),
      merchantPageUrl: query.merchantPageUrl
    };
    chrome.runtime.sendMessage({type:'confirm-pay', detail: d}, (resp) => {
      console.log("got response", resp);
      if ("error" in resp) {
        let source = $_("error-template").innerHTML;
        let template = Handlebars.compile(source);
        $_("status").innerHTML = template(resp);
        return;
      }
    });
  });
});



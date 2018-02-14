# Bilirubin Risk Chart - Simplified

## Overview

This is a simplified version of the Bilirubin Risk Chart app published by the 
HSPC consortium at https://bitbucket.org/hspconsortium/bilirubin-risk-chart
The objective of this version is to be more beginner-friendly than the
original it is based on. Most notably, this version uses vanilla ES6 JavaScript
forfeiting the complexity of advanced frameworks such as AngularJS and ReactJS.
Furthermore, the app is reduced in complexity by dropping some non-essential
features of the original application such as write capabilities, conformance
statement analysis, FHIR version tracking.

## Setup

````
sudo apt-get update
sudo apt-get install npm
sudo apt-get install nodejs
npm install
````

## Serve

````
npm start
````
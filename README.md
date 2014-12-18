OpenSentiment
=============

Open Sentiment is an open source web app that processes social data directly in the browse via javascript. Drag in CSV files and watch your data come to life with interactive visualizations (using d3.js) and sentiment analysis (scoring free text as being positive/negative in nature).

## CSV Data Format

OpenSentiment allows you to combine multiple streams of data into a single table by using a standardized structure that can span across multiple forms, users, questions/categories, and responses/data. 

The data should be stored in a CSV (comma separated value) file. Each row of the CSV file contains one response/datavalue. This approach seems a bit heavy at first (for example, requiring 10 rows to store a 10 question form per submission), but it keeps the structure flexible for future data sources (or multiple sources).

While CSV doesn't nicely scale to huge datasets, it's usually enough to give a thoughtful overview of complex inputs for initial analysis. OpenSentiment is really designed to give initial insights and thus is not optimized for directly supporting massive datasets.

The CSV data should be in exactly this form, with 5 rows in this order.

```
FormID,Date,UserID,Question,Response
```

Blank lines are permitted, as well as comment lines beginning with "#".

See the example_csv_data directory to get a realisitic sense for what the data looks like.

## Loading Data into OpenSentiment

Once you have your data, simply open the index.html file (either locally, or in the latest build hosted at http://akumpf.github.io/OpenSentiment), and drag in your CSV file to corresponding box.

It should look something like this:

![OpenSentiment Screenshot](/screenshot.png?raw=true "Open Sentiment Screenshot")







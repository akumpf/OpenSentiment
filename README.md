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

Note that OpenSentiment will infer the datatype for each row based on the format of the data (and of data in other rows with the same Question). Three main data types are supported:

* Text   (multiple words with spaces, often quoted. If you have multiple paragraphs/sections, separate with a "|" and keep them all on one line)
* Number (integer or float. will parse first number seen: 93%-effective -> 93)
* Enum   (single word selection. Multiple selections via "|": apples|pears -> apples and pears selected)

See the example_csv_data directory to get a realisitic sense for what the data looks like.

## Loading Data into OpenSentiment

Once you have your data, simply open the index.html file (either locally, or in the latest build hosted at http://akumpf.github.io/OpenSentiment), and drag in your CSV file to corresponding box.

Note that **no data is ever transferred** and all analysis and visualization occur via javascript locally, so you can use the online version. But for those who are working with more sensitive datasets, you can also easily download the entire project and just load the index.html file in your local browser.

Once you drag in the data, it should process it and render something like this:

![OpenSentiment Screenshot](/screenshot.png?raw=true "Open Sentiment Screenshot")

## Making Sense of the Data

Currently, OpenSentiment only works for numerical and English language free text input. For text input, each response is given a sentiment value ranging from -1.0 to 1.0, showing how negative or positive it is. 

All entries with a numeric value (either directly numeric or inferred via sentiment) can then be plotted via a box plot. This shows the median (dark vertical line near the center), lower and upper quartile quartile (the main colored box), as well as the minimum and maximum of all data. Extreme data is also accounted for and shows as outliers in light gray circles beyond the extremes when appropriate.

![OpenSentiment BoxPlot data view](/screenshot2.png?raw=true "Open Sentiment BoxPlot data view")

The entire page is interactive, so click around and explore the data.

## Caveats

* Sentiment analysis is currently English only.
* CSV data words great for small/medium datasets, but is too heavy and bulky for massive datasets.
* 

## License

OpenSentiment is Licensed as Creative Commons 0 -- Public Domain except where otherwise notes (the libraries, for example, have their own terms). 

Happy analizing!



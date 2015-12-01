var _ = require('lodash');
var request = require('request').defaults({
    baseUrl: 'https://api.foursquare.com/v2/'
});


var pickResult = {
    'response.likes.count': 'likes_count',
    'response.likes.summary': 'likes_summary'
};

var reqInputs = {
    inputs: [
        'VENUE_ID'
    ],
    env: [
        'FOURSQUARE_CLIENT_ID',
        'FOURSQUARE_CLIENT_SECRET'
    ]
};

var mainFoursquareAuthParam = {
    v: 20140806,
    m: 'foursquare'
};

var successCode = 200;

module.exports = {

    /**
     * Check correct input data.
     *
     * @param step
     * @param dexter
     * @returns {*}
     */
    checkInputs: function (step, dexter) {
        var notIncludeFields = {inputs: [], env: []};

        _.map(reqInputs.inputs, function (inputField) {
            if (_.isNull(step.input(inputField, undefined).first())) {

                notIncludeFields.inputs.push(inputField)
            }
        });

        if (!dexter.environment('FOURSQUARE_OAUTH_TOKEN') && (!dexter.environment('FOURSQUARE_CLIENT_ID') || !dexter.environment('FOURSQUARE_CLIENT_SECRET'))) {

            notIncludeFields.env.push('FOURSQUARE_OAUTH_TOKEN or (FOURSQUARE_CLIENT_ID and FOURSQUARE_CLIENT_SECRET)');
        }

        var err = '';

        if (!_.isEmpty(notIncludeFields.inputs)) {
            err = 'Inputs [' + notIncludeFields.inputs.toString() + '] required for this module; ';
        }

        if (!_.isEmpty(notIncludeFields.env)) {
            err = 'Environment [' + notIncludeFields.env.toString() + '] required for this module; ';

        } else {

            !_.isEmpty(notIncludeFields.inputs)
        }

        return err === ''? false : err;
    },

    /**
     * Return auth object.
     *
     * @param dexter
     * @returns {{client_id: (*|{}|{FOURSQUARE_CLIENT_ID, FOURSQUARE_CLIENT_SECRET}), client_secret: (*|{}|{FOURSQUARE_CLIENT_ID, FOURSQUARE_CLIENT_SECRET})}}
     */
    foursquareAuthParams: function (dexter) {
        var res = {};

        if (dexter.environment('FOURSQUARE_OAUTH_TOKEN')) {
            res = {
                oauth_token: dexter.environment('FOURSQUARE_OAUTH_TOKEN')
            };
        } else {
            res = {
                client_id: dexter.environment('FOURSQUARE_CLIENT_ID'),
                client_secret: dexter.environment('FOURSQUARE_CLIENT_SECRET')
            };
        }

        return _.merge(res, mainFoursquareAuthParam);
    },

    /**
     * Send api request.
     *
     * @param method
     * @param api
     * @param options
     * @param callback
     */
    apiRequest: function (method, api, options, callback) {

        request[method]({url: api, qs: _.merge(_.clone(this.foursquareAuthParams), options), json: true}, callback);
    },

    /**
     * Return foursquare error or false;
     *
     * @param responseBody
     * @returns {*}
     */
    checkResponseError: function (responseBody) {

        if (_.parseInt(_.get(responseBody, 'meta.code')) === successCode) {

            return false;
        } else {

            return _.get(responseBody, 'meta.errorType') || 'Request error';
        }
    },

    /**
     * Return pick result.
     *
     * @param output
     * @returns {*}
     */
    pickResult: function (output) {
        var result = {};

        _.map(_.keys(pickResult), function (val) {

            if (_.has(output, val)) {

                if (_.isArray(pickResult[val]) &&  _.isArray(_.get(output, val))) {
                    result[val] = _.transform(_.get(output, val), function (accumulator, accumulatorValue) {
                        var tmpObj = {};

                        _.map(pickResult[val], function (keyInArray) {
                            tmpObj[keyInArray] = accumulatorValue[keyInArray];
                        });
                        accumulator.push(tmpObj);
                    });
                } else {
                    _.set(result, pickResult[val], _.get(output, val));
                }
            }
        });

        return result;
    },

    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {
        var reqAttrErr = this.checkInputs(step, dexter);

        if (reqAttrErr) {

            this.fail(reqAttrErr);
        } else {

            this.apiRequest(
                'get',
                'venues/' + step.input('VENUE_ID').first() + '/likes',
                this.foursquareAuthParams(dexter),
                function (error, response, body) {
                    var errorType = this.checkResponseError(body);

                    errorType === false? this.complete(this.pickResult(body)) : this.fail(errorType);
                }.bind(this)
            );
        }
    }
};

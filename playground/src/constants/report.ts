export const pendoJS = `function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track'];for(w=0,x=v.length;w<x;++w)(function(m){
        o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
        y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
        z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');

    pendo.initialize({
        visitor: {
            id: <visitor-id-goes-here>,
            email: <email-goes-here>,
            firstName: <first-name-goes-here>,
            lastName: <last-name-goes-here>,
        },
        account: {
            id: <account-id-goes-here>,
            accountName: <account-name-goes-here>,
            payingStatus: <paying-status-goes-here>,
            location: <location-goes-here>,
            accountCreationDate: <account-creation-date-goes-here>,
            marketSegment: <market-segment-goes-here>,
        }
    });
})('aea620fc-be9c-4767-a609-c7bd9d167a2d');`

const subsitutitons = {
    rust: [
        ['bstof', 'b"$0"'],
        ['bchof', "b'$0'"],
        ['stof', '"$0"'],
        ['chof', "'$0'"],
        ['string', 'String'],
        ['mapof', 'HashMap<$0,>'],
        ['vecof', 'Vec<$0>'],
        ['setof', 'HashSet<$0>'],
        ['evec', 'vec![]'],
    ],
};

export default subsitutitons;
/* eslint-disable @typescript-eslint/no-unused-vars */
import assert from "assert";
import { createAliasResolver, defineAbility } from "@casl/ability";
import { feathers } from "@feathersjs/feathers";
import authorize from "../../../lib/hooks/authorize/authorize.hook";
import { Service } from "feathers-memory";
import { joinQuery } from "feathers-fletching";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove"
});

describe.skip("authorize.relations", function() {
  const mock = () => {
    const app = feathers();
    app.use("artists", new Service({ 
      startId: 1,
      whitelist: ["$not", "$and"],
    }));
    app.use("albums", new Service({ 
      startId: 1,
      whitelist: ["$not", "$and"]
    }));

    const serviceArtists = app.service("artists");
    const serviceAlbums = app.service("albums");

    const joinQueriesAlbums = joinQuery({
      artist: {
        service: "artists",
        foreignKey: "artistId",
        targetKey: "id",
        makeParams: (params, context) => {
          return {
            ...params,
            user: context.params.user,
            ability: context.params.ability
          };
        }
      }
    });

    serviceArtists.hooks({
      before: {
        all: [
          authorize()
        ],
        find: [],
        get: [],
        create: [],
        update: [],
        patch: [],
        remove: []
      },
      after: {
        all: [
          authorize()
        ],
        find: [],
        get: [],
        create: [],
        update: [],
        patch: [],
        remove: []
      }
    });

    serviceAlbums.hooks({
      before: {
        all: [
          authorize(),
          joinQueriesAlbums,
        ],
        find: [],
        get: [],
        create: [],
        update: [],
        patch: [],
        remove: []
      },
      after: {
        all: [
          joinQueriesAlbums,
          authorize()
        ],
        find: [],
        get: [],
        create: [],
        update: [],
        patch: [],
        remove: []
      }
    });

    return {
      app,
      serviceAlbums,
      serviceArtists
    };
  };

  it("basic example without ability", async function() {
    const { serviceAlbums, serviceArtists } = mock();
    const blink182 = await serviceArtists.create({ name: "Blink182" });
    const sum41 = await serviceArtists.create({ name: "Sum 41" });
    const justinBieber = await serviceArtists.create({ name: "Justin Bieber" });

    const enemaOfTheState = await serviceAlbums.create({ name: "Enema of the State", artistId: blink182.id, date: 1999 });
    const pantsAndJacket = await serviceAlbums.create({ name: "Take Off Your Pants and Jacket", artistId: blink182.id, date: 2001 });
    const california = await serviceAlbums.create({ name: "California", artistId: blink182.id, date: 2016 });

    const killer = await serviceAlbums.create({ name: "All Killer No Filler", artistId: sum41.id, date: 2001 });
    const hero = await serviceAlbums.create({ name: "Underclass Hero", artistId: sum41.id, date: 2007 });

    const believe = await serviceAlbums.create({ name: "Believe", artistId: justinBieber.id, date: 2012 });
    const purpose = await serviceAlbums.create({ name: "Purpose", artistId: justinBieber.id, date: 2020 });

    const albumsOfBlink = await serviceAlbums.find({ query: { "artist.name": "Blink182" } });
    assert.deepStrictEqual(
      albumsOfBlink.sort(), 
      [enemaOfTheState, pantsAndJacket, california].sort(), 
      "found all albums of blink182"
    );
  });

  it("basic example with ability", async function() {
    const { app, serviceAlbums, serviceArtists } = mock();
    const blink182 = await serviceArtists.create({ name: "Blink182" });
    const sum41 = await serviceArtists.create({ name: "Sum 41" });
    const justinBieber = await serviceArtists.create({ name: "Justin Bieber" });

    const enemaOfTheState = await serviceAlbums.create({ name: "Enema of the State", artistId: blink182.id, date: 1999 });
    const pantsAndJacket = await serviceAlbums.create({ name: "Take Off Your Pants and Jacket", artistId: blink182.id, date: 2001 });
    const california = await serviceAlbums.create({ name: "California", artistId: blink182.id, date: 2016 });

    const killer = await serviceAlbums.create({ name: "All Killer No Filler", artistId: sum41.id, date: 2001 });
    const hero = await serviceAlbums.create({ name: "Underclass Hero", artistId: sum41.id, date: 2007 });

    const believe = await serviceAlbums.create({ name: "Believe", artistId: justinBieber.id, date: 2012 });
    const purpose = await serviceAlbums.create({ name: "Purpose", artistId: justinBieber.id, date: 2020 });

    const albumsOfBlink = await serviceAlbums.find({ 
      query: { "artist.name": "Blink182" },
      ability: defineAbility((can) => {
        can("read", "albums");
        can("read", "artists", { name: "Justin Bieber" });
      }, { resolveAction })
    });
    
    assert.deepStrictEqual(
      albumsOfBlink, 
      [], 
      "found no albums of blink182"
    );
  });

  it("dot.notation in ability", async function() {
    const { app, serviceAlbums, serviceArtists } = mock();
    const blink182 = await serviceArtists.create({ name: "Blink182" });
    const sum41 = await serviceArtists.create({ name: "Sum 41" });
    const justinBieber = await serviceArtists.create({ name: "Justin Bieber" });

    const enemaOfTheState = await serviceAlbums.create({ name: "Enema of the State", artistId: blink182.id, date: 1999 });
    const pantsAndJacket = await serviceAlbums.create({ name: "Take Off Your Pants and Jacket", artistId: blink182.id, date: 2001 });
    const california = await serviceAlbums.create({ name: "California", artistId: blink182.id, date: 2016 });

    const killer = await serviceAlbums.create({ name: "All Killer No Filler", artistId: sum41.id, date: 2001 });
    const hero = await serviceAlbums.create({ name: "Underclass Hero", artistId: sum41.id, date: 2007 });

    const believe = await serviceAlbums.create({ name: "Believe", artistId: justinBieber.id, date: 2012 });
    const purpose = await serviceAlbums.create({ name: "Purpose", artistId: justinBieber.id, date: 2020 });

    const albumsOfBlink = await serviceAlbums.find({ 
      query: {},
      ability: defineAbility((can) => {
        can("read", "albums", { "artist.name": "Blink182" });
        can("read", "artists");
      }, { resolveAction })
    });
    
    assert.deepStrictEqual(
      albumsOfBlink.sort(), 
      [enemaOfTheState, pantsAndJacket, california].sort(), 
      "only can read albums of blink182"
    );
  });
});

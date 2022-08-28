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

describe("authorize.relations", function() {
  const mock = () => {
    const app = feathers();
    app.use("artists", new Service({
      multi: true,
      startId: 1,
      whitelist: ["$not", "$and"]
    }));
    app.use("albums", new Service({
      multi: true,
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

  describe("find", function() {
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

    it.only("basic example with ability", async function() {
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

      // Why should this fail instead of returning an empty result?
      const shouldFail = serviceAlbums.find({
        query: { "artist.name": "Blink182" },
        ability: defineAbility((can) => {
          can("read", "albums");
          can("read", "artists", { name: "Justin Bieber" });
        }, { resolveAction })
      } as any)
        .then(result => {
          console.log(result);
        }).catch((error: unknown) => {
          console.log(error);
        });

      await assert.rejects(
        shouldFail,
        (err: Error) => err.name === "NotFound",
        "found no albums"
      );

      const albumsOfBlink = await serviceAlbums.find({ 
        query: { "artist.name": "Blink182" },
        ability: defineAbility((can) => {
          can("read", "albums");
          can("read", "artists", { name: "Blink182" });
        }, { resolveAction })
      
      } as any);
      assert.deepStrictEqual(
        albumsOfBlink.sort(), 
        [enemaOfTheState, pantsAndJacket, california].sort(), 
        "found all albums of blink182"
      );
    });

    it("basic example with ability with $select", async function() {
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

      await assert.rejects(
        serviceAlbums.find({ 
          query: { "artist.name": "Blink182", $select: ["id"] },
          ability: defineAbility((can) => {
            can("read", "albums");
            can("read", "artists", { name: "Justin Bieber" });
          }, { resolveAction })
        } as any),
        (err: Error) => err.name === "NotFound",
        "found no albums"
      );
      
      const albumsOfBlink = await serviceAlbums.find({ 
        query: { "artist.name": "Blink182", $select: ["id"] },
        ability: defineAbility((can) => {
          can("read", "albums");
          can("read", "artists", { name: "Blink182" });
        }, { resolveAction })
      } as any);

      assert.deepStrictEqual(
        albumsOfBlink.sort(), 
        [{ id: enemaOfTheState.id }, { id: pantsAndJacket.id }, { id: california.id }].sort(), 
        "found all albums of blink182"
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
      } as any);

      assert.deepStrictEqual(
        albumsOfBlink.sort(), 
        [enemaOfTheState, pantsAndJacket, california].sort(), 
        "only can read albums of blink182"
      );
    });
  });

  describe("patch", function() {
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
  
      const albumsOfBlink = await serviceAlbums.patch(null, {
        stars: 5
      }, { 
        query: {},
        ability: defineAbility((can) => {
          can("read", "albums");
          can(["update"], "albums", { "artist.name": "Blink182" });
          can("read", "artists");
        }, { resolveAction })
      } as any);

      assert.deepStrictEqual(
        albumsOfBlink, 
        [
          { ...enemaOfTheState, stars: 5 },
          { ...pantsAndJacket, stars: 5 },
          { ...california, stars: 5 }
        ], 
        "only updated Albums of Blink182"
      );

      const otherAlbums = await serviceAlbums.find({
        query: {
          "artist.name": { $ne: "Blink182" }
        },
        paginate: false
      } as any);

      assert.strictEqual(otherAlbums.length, 4, "albums not from Blink182 are four");

      assert.ok(otherAlbums.every(x => !x.stars), "none of other albums has stars");
    });
  });

  describe.skip("remove", function() {
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
  
      const albumsOfBlink = await serviceAlbums.patch(null, {
        stars: 5
      }, { 
        query: {},
        ability: defineAbility((can) => {
          can("read", "albums");
          can(["update"], "albums", { "artist.name": "Blink182" });
          can("read", "artists");
        }, { resolveAction })
      } as any);

      assert.deepStrictEqual(
        albumsOfBlink, 
        [
          { ...enemaOfTheState, stars: 5 },
          { ...pantsAndJacket, stars: 5 },
          { ...california, stars: 5 }
        ], 
        "only updated Albums of Blink182"
      );

      const otherAlbums = await serviceAlbums.find({
        query: {
          "artist.name": { $ne: "Blink182" }
        },
        paginate: false
      } as any);

      assert.strictEqual(otherAlbums.length, 4, "albums not from Blink182 are four");

      assert.ok(otherAlbums.every(x => !x.stars), "none of other albums has stars");
    });
  });
});

import Foundation
import Testing
@testable import StudioKit

struct WorldRelationshipsTests {
    @Test("Builds links through stable IDs and skips unresolved targets")
    func linkedRecords() throws {
        let chars = try JSONDecoder().decode([ContentEntry].self, from: Data(#"""
        [
          {"path":"adv/characters/original-name.character.md","name":"Renamed","data":{"id":"lin","relationships":[{"targetId":"mo","type":"friends"},{"targetId":"missing","type":"enemy"}]}},
          {"path":"adv/characters/mo.character.md","name":"Mo","data":{"id":"mo"}}
        ]
        """#.utf8))
        let places = try JSONDecoder().decode([ContentEntry].self, from: Data(#"""
        [
          {"path":"adv/locations/first.md","name":"First","data":{"id":"one","linkedCharacters":["lin","missing"]}},
          {"path":"adv/locations/second.md","name":"Second","data":{"id":"two","linkedCharacters":["lin","missing","mo"]}},
          {"path":"adv/locations/third.md","name":"Third","data":{"id":"three","linkedCharacters":["missing"]}}
        ]
        """#.utf8))
        let character = try #require(WorldRelationships.characters(chars).only)
        #expect(character.source == chars[0].path)
        #expect(character.target == chars[1].path)
        #expect(character.label == "friends")
        let location = try #require(WorldRelationships.locations(places, characters: chars).only)
        #expect(location.source == places[0].path)
        #expect(location.target == places[1].path)
        #expect(location.label == "Renamed")
    }
}

private extension Array {
    var only: Element? { count == 1 ? first : nil }
}
